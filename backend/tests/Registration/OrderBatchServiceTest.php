<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Registration\Services\OrderBatchService;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Logging\ExternalErrorLogRepository;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

final class OrderBatchServiceTest extends TestCase
{
    public function testPrunesExternalErrorsInTheSameTestDatabase(): void
    {
        $pdo = TestDatabase::create();
        $this->addRetention($pdo);
        $errors = new ExternalErrorLogRepository($pdo);
        $errors->create('email', 'smtp_send', 'First failure');
        $errors->create('email', 'smtp_send', 'Second failure');
        $previousLimit = getenv('EXTERNAL_ERROR_LOG_MAX_ENTRIES');
        putenv('EXTERNAL_ERROR_LOG_MAX_ENTRIES=1');

        try {
            $this->service($pdo, new RecordingEmailSender())->run();

            self::assertSame(1, (int) $pdo->query('SELECT COUNT(*) FROM external_error_logs')->fetchColumn());
        } finally {
            putenv($previousLimit === false ? 'EXTERNAL_ERROR_LOG_MAX_ENTRIES' : 'EXTERNAL_ERROR_LOG_MAX_ENTRIES=' . $previousLimit);
        }
    }

    public function testFailedQueuedOrderEmailRemainsQueued(): void
    {
        $pdo = TestDatabase::create();
        $this->addRetention($pdo);
        $emails = new RecordingEmailSender();
        $emails->failStoredEmail = true;
        (new EmailQueueRepository($pdo))->enqueue(
            'order',
            'order-1',
            'order_confirmation',
            'person@example.com',
            ['subject' => 'subject', 'html' => 'html', 'text' => 'text'],
            'SMTP failed',
        );

        $result = $this->service($pdo, $emails)->run();

        self::assertSame(1, $result['failed']);
        self::assertSame(0, $result['sent']);
        self::assertCount(1, (new EmailQueueRepository($pdo))->pending());
    }

    public function testSuccessfulQueuedOrderEmailIsRemovedAndOrderIsUpdated(): void
    {
        $pdo = TestDatabase::create();
        $this->addRetention($pdo);
        $emails = new RecordingEmailSender();
        $orders = new OrderRepository($pdo);
        $user = (new UserRepository($pdo))->createUser('person@example.com', 'secret', 'wunschbesteller');
        $order = $orders->saveForYear($user['id'], 2026, 'in_review', 1, 0, []);
        (new EmailQueueRepository($pdo))->enqueue(
            'order',
            $order['id'],
            'order_confirmation',
            'person@example.com',
            ['subject' => 'subject', 'html' => 'html', 'text' => 'text'],
            '',
        );

        $result = $this->service($pdo, $emails)->run();

        self::assertSame(1, $result['sent']);
        self::assertSame('in_review', $orders->findForYear($user['id'], 2026)['status']);
        self::assertNotNull($orders->findForYear($user['id'], 2026)['confirmationEmailSentAt']);
        self::assertCount(0, (new EmailQueueRepository($pdo))->pending());
    }

    private function service(\PDO $pdo, RecordingEmailSender $emails): OrderBatchService
    {
        return new OrderBatchService(
            new OrderRepository($pdo),
            new EmailQueueRepository($pdo),
            new FrontendConfigRepository($pdo),
            $emails,
            new RegistrationTokenRepository($pdo),
            externalErrors: new ExternalErrorLogRepository($pdo),
        );
    }

    private function addRetention(\PDO $pdo): void
    {
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
             VALUES (:id, :name, :value, :access, :update, :label)',
        )->execute([
            'id' => 'config-retention',
            'name' => 'registration_token_retention_days',
            'value' => json_encode('365', JSON_THROW_ON_ERROR),
            'access' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'update' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => 'Token Retention',
        ]);
    }
}
