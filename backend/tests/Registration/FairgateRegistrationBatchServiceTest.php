<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Fairgate\Services\FairgateContactProvider;
use App\Registration\Data\FairgateRegistrationRequestRepository;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\FairgateRegistrationBatchService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

final class FairgateRegistrationBatchServiceTest extends TestCase
{
    public function testChecksDueRequestAndSendsGenericStartLinkWhenFound(): void
    {
        $pdo = TestDatabase::create();
        $requests = new FairgateRegistrationRequestRepository($pdo);
        $requests->saveWaiting('person@example.com', $this->date('2026-11-08 00:00:00'));
        $emails = new RecordingEmailSender();

        $result = $this->service($pdo, new FairgateRegistrationFixedProvider(true), $emails)->run();

        self::assertSame(['checked' => 1, 'notified' => 1, 'failed' => 0], $result);
        self::assertSame('notification_sent', $pdo->query('SELECT status FROM fairgate_registration_requests')->fetchColumn());
        self::assertSame('http://localhost:4200/start', $emails->loginUrls[0]);
        self::assertSame(\App\Registration\Services\AnmeldungMailVariant::FairgateRegistrationAvailable, $emails->variants[0]);
        self::assertSame(0, (int) $pdo->query('SELECT COUNT(*) FROM registration_tokens')->fetchColumn());
    }

    public function testLeavesRequestWaitingWhenNotFoundAndDoesNotSendEmail(): void
    {
        $pdo = TestDatabase::create();
        $requests = new FairgateRegistrationRequestRepository($pdo);
        $requests->saveWaiting('person@example.com', $this->date('2026-11-08 00:00:00'));
        $emails = new RecordingEmailSender();

        $result = $this->service($pdo, new FairgateRegistrationFixedProvider(false), $emails)->run();

        self::assertSame(['checked' => 1, 'notified' => 0, 'failed' => 0], $result);
        self::assertSame('waiting_for_fairgate', $pdo->query('SELECT status FROM fairgate_registration_requests')->fetchColumn());
        self::assertNotNull($pdo->query('SELECT last_checked_at FROM fairgate_registration_requests')->fetchColumn());
        self::assertCount(0, $emails->variants);
    }

    public function testSkipsRequestCheckedLessThanTwelveHoursAgo(): void
    {
        $pdo = TestDatabase::create();
        $requests = new FairgateRegistrationRequestRepository($pdo);
        $requests->saveWaiting('person@example.com', $this->date('2026-11-08 00:00:00'));
        $id = (string) $pdo->query('SELECT id FROM fairgate_registration_requests')->fetchColumn();
        $requests->markChecked($id, $this->date('2026-11-08 06:00:00'));

        $result = $this->service($pdo, new FairgateRegistrationFixedProvider(true), new RecordingEmailSender(), '2026-11-08 17:59:59')->run();

        self::assertSame(['checked' => 0, 'notified' => 0, 'failed' => 0], $result);
    }

    public function testContinuesWithNextRequestWhenFairgateFails(): void
    {
        $pdo = TestDatabase::create();
        $requests = new FairgateRegistrationRequestRepository($pdo);
        $requests->saveWaiting('failed@example.com', $this->date('2026-11-08 00:00:00'));
        $requests->saveWaiting('found@example.com', $this->date('2026-11-08 00:00:00'));
        $emails = new RecordingEmailSender();

        $result = $this->service($pdo, new FairgateRegistrationFailingProvider(), $emails)->run();

        self::assertSame(['checked' => 1, 'notified' => 1, 'failed' => 1], $result);
        self::assertSame(1, (int) $pdo->query("SELECT COUNT(*) FROM fairgate_registration_requests WHERE status = 'notification_sent'")->fetchColumn());
    }

    private function service(
        \PDO $pdo,
        FairgateContactProvider $fairgate,
        RecordingEmailSender $emails,
        string $now = '2026-11-08 12:00:00',
    ): FairgateRegistrationBatchService {
        return new FairgateRegistrationBatchService(
            new FairgateRegistrationRequestRepository($pdo),
            $fairgate,
            new AnmeldungService($emails),
            $this->date($now),
        );
    }

    private function date(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('UTC'));
    }
}

final class FairgateRegistrationFixedProvider implements FairgateContactProvider
{
    public function __construct(private readonly bool $found)
    {
    }

    public function hasContactByEmail(string $email, string $membership): bool
    {
        return $this->found;
    }

    public function findContactDataByEmail(string $email, string $membership): array
    {
        return ['success' => true, 'data' => null];
    }
}

final class FairgateRegistrationFailingProvider implements FairgateContactProvider
{
    public function hasContactByEmail(string $email, string $membership): bool
    {
        if ($email === 'failed@example.com') {
            throw new \RuntimeException('Fairgate unavailable');
        }

        return true;
    }

    public function findContactDataByEmail(string $email, string $membership): array
    {
        return ['success' => true, 'data' => null];
    }
}
