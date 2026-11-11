<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Data\FairgateRegistrationRequestRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class FairgateRegistrationRequestRepositoryTest extends TestCase
{
    public function testSavesNormalizedWaitingRequest(): void
    {
        $pdo = TestDatabase::create();
        $repository = new FairgateRegistrationRequestRepository($pdo);
        $now = $this->date('2026-11-08 12:00:00');

        $repository->saveWaiting('  Person@Example.com ', $now);

        $request = $pdo->query('SELECT * FROM fairgate_registration_requests')->fetch();
        self::assertSame('person@example.com', $request['email']);
        self::assertNull($request['notification_sent_at']);
        self::assertSame('2026-11-08 12:00:00', $request['requested_at']);
    }

    public function testSavingSameEmailRefreshesExistingRequest(): void
    {
        $pdo = TestDatabase::create();
        $repository = new FairgateRegistrationRequestRepository($pdo);
        $repository->saveWaiting('person@example.com', $this->date('2026-11-08 12:00:00'));
        $repository->markChecked((string) $pdo->query('SELECT id FROM fairgate_registration_requests')->fetchColumn(), $this->date('2026-11-08 12:01:00'));

        $repository->saveWaiting('PERSON@example.com', $this->date('2026-11-08 13:00:00'));

        self::assertSame(1, (int) $pdo->query('SELECT COUNT(*) FROM fairgate_registration_requests')->fetchColumn());
        $request = $pdo->query('SELECT notification_sent_at, requested_at, last_checked_at FROM fairgate_registration_requests')->fetch();
        self::assertNull($request['notification_sent_at']);
        self::assertSame('2026-11-08 13:00:00', $request['requested_at']);
        self::assertNull($request['last_checked_at']);
    }

    public function testFindsOnlyRequestsDueForChecking(): void
    {
        $pdo = TestDatabase::create();
        $repository = new FairgateRegistrationRequestRepository($pdo);
        $repository->saveWaiting('due@example.com', $this->date('2026-11-08 00:00:00'));
        $repository->saveWaiting('recent@example.com', $this->date('2026-11-08 11:00:00'));
        $recentId = (string) $pdo->query("SELECT id FROM fairgate_registration_requests WHERE email = 'recent@example.com'")->fetchColumn();
        $repository->markChecked($recentId, $this->date('2026-11-08 11:30:00'));

        $due = $repository->findDue($this->date('2026-11-08 12:00:00'), new DateInterval('PT12H'));

        self::assertCount(1, $due);
        self::assertSame('due@example.com', $due[0]['email']);
    }

    public function testMarksFoundRequestAsNotified(): void
    {
        $pdo = TestDatabase::create();
        $repository = new FairgateRegistrationRequestRepository($pdo);
        $repository->saveWaiting('person@example.com', $this->date('2026-11-08 00:00:00'));
        $id = (string) $pdo->query('SELECT id FROM fairgate_registration_requests')->fetchColumn();
        $foundAt = $this->date('2026-11-08 12:00:00');

        $repository->markNotificationSent($id, $foundAt, $foundAt->modify('+1 minute'));

        $request = $pdo->query('SELECT * FROM fairgate_registration_requests')->fetch();
        self::assertSame('2026-11-08 12:00:00', $request['fairgate_found_at']);
        self::assertSame('2026-11-08 12:01:00', $request['notification_sent_at']);
        self::assertCount(0, $repository->findDue($foundAt->modify('+12 hours'), new DateInterval('PT12H')));
    }

    private function date(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('UTC'));
    }
}
