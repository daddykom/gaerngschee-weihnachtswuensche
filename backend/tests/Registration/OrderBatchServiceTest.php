<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Services\FairgateContactProvider;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Registration\Services\OrderBatchService;
use App\Shared\Logging\ExternalErrorLogRepository;
use App\Shared\Mail\EmailQueueRepository;
use App\Users\Data\UserRepository;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;
use PHPUnit\Framework\TestCase;

final class OrderBatchServiceTest extends TestCase
{
    public function testFailedEmailIsQueuedAndLeavesOrderWaitingForFairgate(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('person+fair1@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $this->addInterval($pdo);
        $emails = new RecordingEmailSender();
        $emails->failStoredEmail = true;

        $result = $this->service($pdo, $emails, new FixedFairgateProvider(1, 0))->run();

        self::assertSame(0, $result['failed']);
        self::assertSame(1, $result['queued']);
        self::assertSame('waiting_for_fairgate', $orders->findForYear($user['id'], 2026)['status']);
        self::assertCount(1, (new EmailQueueRepository($pdo))->pending());
    }

    public function testNextBatchRunRetriesFailedEmail(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('person+fair1@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $this->addInterval($pdo);
        $emails = new RecordingEmailSender();
        $emails->failStoredEmail = true;
        $service = $this->service($pdo, $emails, new FixedFairgateProvider(1, 0));
        $service->run();

        $emails->failStoredEmail = false;
        $result = $service->run();

        self::assertSame(1, $result['sent']);
        self::assertSame(0, $result['loaded']);
        self::assertSame('released', $orders->findForYear($user['id'], 2026)['status']);
        self::assertCount(0, (new EmailQueueRepository($pdo))->pending());
    }

    public function testSendsFirstFairgateReminderAfterTheConfiguredInterval(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('person+reminder@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $order = $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $pdo->prepare('UPDATE orders SET created_at = :created_at WHERE id = :id')->execute([
            'created_at' => '2000-01-01 00:00:00',
            'id' => $order['id'],
        ]);
        $this->addInterval($pdo);
        $emails = new RecordingEmailSender();

        $result = $this->service($pdo, $emails, new MissingFairgateProvider())->run();
        $updated = $orders->findForYear($user['id'], 2026);

        self::assertSame(1, $result['loaded']);
        self::assertSame(1, $result['sent']);
        self::assertNotNull($updated['fairgateReminderEmailSentAt']);
        self::assertStringContainsString('Fairgate', $emails->orderConfirmations[0]['order']['html']);
    }

    public function testDoesNotSendFairgateReminderAfterConfiguredEndDate(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('person+reminder-end@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $order = $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $pdo->prepare('UPDATE orders SET created_at = :created_at WHERE id = :id')->execute([
            'created_at' => '2000-01-01 00:00:00',
            'id' => $order['id'],
        ]);
        $this->addInterval($pdo);
        $this->addReminderEndDate($pdo, '2000-01-01');
        $emails = new RecordingEmailSender();

        $result = $this->service($pdo, $emails, new MissingFairgateProvider())->run();

        self::assertSame(0, $result['sent']);
        self::assertNull($orders->findForYear($user['id'], 2026)['fairgateReminderEmailSentAt']);
        self::assertCount(0, $emails->orderConfirmations);
    }

    public function testRemovesQueuedFairgateReminderAfterConfiguredEndDate(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('person+reminder-queue-end@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $order = $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $pdo->prepare('UPDATE orders SET created_at = :created_at WHERE id = :id')->execute([
            'created_at' => '2000-01-01 00:00:00',
            'id' => $order['id'],
        ]);
        $this->addInterval($pdo);
        $this->addReminderEndDate($pdo, '2999-12-31');
        $emails = new RecordingEmailSender();
        $emails->failStoredEmail = true;
        $service = $this->service($pdo, $emails, new MissingFairgateProvider());

        $service->run();
        $this->setReminderEndDate($pdo, '2000-01-01');
        $emails->failStoredEmail = false;

        $result = $service->run();

        self::assertSame(0, $result['sent']);
        self::assertCount(0, (new EmailQueueRepository($pdo))->pending());
    }

    public function testFailedFairgateReminderIsQueuedAndRetried(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('reminder-retry@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $order = $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $pdo->prepare('UPDATE orders SET created_at = :created_at WHERE id = :id')->execute([
            'created_at' => '2000-01-01 00:00:00',
            'id' => $order['id'],
        ]);
        $this->addInterval($pdo);
        $emails = new RecordingEmailSender();
        $emails->failStoredEmail = true;
        $service = $this->service($pdo, $emails, new MissingFairgateProvider());

        $failed = $service->run();
        self::assertSame(1, $failed['queued']);
        self::assertNull($orders->findForYear($user['id'], 2026)['fairgateReminderEmailSentAt']);

        $emails->failStoredEmail = false;
        $retried = $service->run();
        $updated = $orders->findForYear($user['id'], 2026);

        self::assertSame(1, $retried['sent']);
        self::assertNotNull($updated['fairgateReminderEmailSentAt']);
        self::assertCount(0, (new EmailQueueRepository($pdo))->pending());
    }

    public function testSuccessfulOrderIsNotSentAgainOnTheNextBatchRun(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('idempotent@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $orders->saveForYear($user['id'], 2026, 'waiting_for_fairgate', 1, 0, [
            ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
        ]);
        $this->addInterval($pdo);
        $emails = new RecordingEmailSender();
        $service = $this->service($pdo, $emails, new FixedFairgateProvider(1, 0));

        $first = $service->run();
        $second = $service->run();

        self::assertSame(1, $first['sent']);
        self::assertSame(0, $second['loaded']);
        self::assertSame(0, $second['sent']);
        self::assertCount(1, $emails->orderConfirmations);
    }

    private function service($pdo, RecordingEmailSender $emails, FairgateContactProvider $fairgate): OrderBatchService
    {
        return new OrderBatchService(
            new OrderRepository($pdo),
            new EmailQueueRepository($pdo),
            new FrontendConfigRepository($pdo),
            $fairgate,
            $emails,
            new RegistrationTokenRepository($pdo),
            new ExternalErrorLogRepository($pdo),
            null,
        );
    }

    private function addInterval($pdo): void
    {
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
             VALUES (:id, :name, :value, :access, :update, :label)',
        )->execute([
            'id' => 'config-interval',
            'name' => 'fairgate_email_interval_days',
            'value' => json_encode('7', JSON_THROW_ON_ERROR),
            'access' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'update' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => 'Interval',
        ]);
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
             VALUES (:id, :name, :value, :access, :update, :label)',
        )->execute([
            'id' => 'config-campaign-year',
            'name' => 'campaign_year',
            'value' => json_encode('2026', JSON_THROW_ON_ERROR),
            'access' => json_encode(['admin', 'wunschbesteller'], JSON_THROW_ON_ERROR),
            'update' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => 'Campaign Year',
        ]);
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
             VALUES (:id, :name, :value, :access, :update, :label)',
        )->execute([
            'id' => 'config-retention',
            'name' => 'registration_token_retention_days',
            'value' => json_encode('365', JSON_THROW_ON_ERROR),
            'access' => json_encode([], JSON_THROW_ON_ERROR),
            'update' => json_encode([], JSON_THROW_ON_ERROR),
            'label' => 'Token Retention',
        ]);
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
             VALUES (:id, :name, :value, :access, :update, :label)',
        )->execute([
            'id' => 'config-fairgate-url',
            'name' => 'fairgate_url',
            'value' => json_encode('https://fairgate.example', JSON_THROW_ON_ERROR),
            'access' => json_encode([], JSON_THROW_ON_ERROR),
            'update' => json_encode([], JSON_THROW_ON_ERROR),
            'label' => 'Fairgate URL',
        ]);
    }

    private function addReminderEndDate($pdo, string $value): void
    {
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
             VALUES (:id, :name, :value, :access, :update, :label)',
        )->execute([
            'id' => 'config-reminder-end-date',
            'name' => 'fairgate_reminder_end_date',
            'value' => json_encode($value, JSON_THROW_ON_ERROR),
            'access' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'update' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => 'Reminder End Date',
        ]);
    }

    private function setReminderEndDate($pdo, string $value): void
    {
        $pdo->prepare(
            'UPDATE frontend_config SET value = :value WHERE variable_name = :name',
        )->execute([
            'name' => 'fairgate_reminder_end_date',
            'value' => json_encode($value, JSON_THROW_ON_ERROR),
        ]);
    }
}

final class FixedFairgateProvider implements FairgateContactProvider
{
    public function __construct(private readonly int $adults, private readonly int $children)
    {
    }

    public function hasContactByEmail(string $email): bool
    {
        return true;
    }

    public function findContactDataByEmail(string $email, ?string $membership = null): array
    {
        $data = ['wohnt_im_gleichen_haushalt' => $this->adults === 2 ? 'Ja' : 'Nein'];
        for ($index = 1; $index <= $this->children; $index++) {
            $data['name_und_vorname_kind' . $index] = 'Kind ' . $index;
            $data['geburtsdatum_kind' . $index] = '2010-01-01';
        }
        return ['success' => true, 'data' => $data];
    }
}

final class MissingFairgateProvider implements FairgateContactProvider
{
    public function hasContactByEmail(string $email): bool
    {
        return false;
    }

    public function findContactDataByEmail(string $email, ?string $membership = null): array
    {
        return ['success' => false, 'data' => null];
    }
}
