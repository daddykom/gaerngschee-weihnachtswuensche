<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Registration\Services\OrderBatchService;
use App\Shared\Logging\ExternalErrorLogRepository;
use App\Shared\Mail\EmailQueueRepository;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

final class OrderAcceptanceNotificationTest extends TestCase
{
    public function testFailureToPersistTheIntentRollsBackTheStatusAndWishChanges(): void
    {
        [$pdo, $orders, $order] = $this->fixture();
        $pdo->exec('DROP TABLE email_queue');
        try {
            $orders->saveAdministration($order, $order['items']);
            self::fail('The missing outbox must make the save fail.');
        } catch (\PDOException) {
            $saved = $orders->findById($order['id']);
            self::assertSame('released', $saved['status']);
            self::assertNull($saved['orderNumber']);
            self::assertSame('submitted', $saved['items'][0]['publicationStatus']);
        }
    }

    public function testStatusChangeCreatesOneIntentAndRepeatedSavesDoNotBackfillLegacyOrders(): void
    {
        [$pdo, $orders, $order] = $this->fixture();
        $saved = $orders->saveAdministration($order, $order['items']);
        $orders->saveAdministration($order, $order['items']);
        self::assertSame('definitive', $saved['status']);
        $queue = new EmailQueueRepository($pdo);
        self::assertCount(1, $queue->pending());
        self::assertSame('', $queue->pending()[0]['html_body']);
        $queue->remove($queue->pending()[0]['id']);
        $orders->saveAdministration($order, $order['items']);
        self::assertSame([], $queue->pending());
    }

    public function testMissingConfigurationKeepsIntentAndRetryStoresOneImmutableMessage(): void
    {
        [$pdo, $orders, $order] = $this->fixture();
        $orders->saveAdministration($order, $order['items']);
        $renderMissing = static fn () => throw new \RuntimeException('Missing pickup configuration');
        $neverSend = static fn () => self::fail('An incomplete message must not be sent.');
        self::assertSame('pending', $orders->deliverAcceptanceNotification($order['id'], $renderMissing, $neverSend));
        $queue = new EmailQueueRepository($pdo);
        self::assertCount(1, $queue->pending());
        self::assertSame('', $queue->pending()[0]['html_body']);
        self::assertNull($pdo->query('SELECT acceptance_email_sent_at FROM orders')->fetchColumn());

        $message = ['subject' => 'Accepted', 'html' => 'Configured pickup details', 'text' => "Saal A\nStreet 1"];
        $render = static fn () => $message;
        $failSmtp = static fn () => throw new \RuntimeException('SMTP failed');
        self::assertSame('pending', $orders->deliverAcceptanceNotification($order['id'], $render, $failSmtp));
        self::assertSame($message['html'], $queue->pending()[0]['html_body']);

        $neverRender = static fn () => self::fail('Retries must keep the stored pickup details.');
        $sent = [];
        $send = static function (array $email) use (&$sent): void {
            $sent[] = $email;
        };
        self::assertSame('sent', $orders->deliverAcceptanceNotification($order['id'], $neverRender, $send));
        self::assertSame('sent', $orders->deliverAcceptanceNotification($order['id'], $neverRender, $send));
        self::assertCount(1, $sent);
        self::assertSame($message['text'], $sent[0]['text_body']);
        self::assertNotNull($pdo->query('SELECT acceptance_email_sent_at FROM orders')->fetchColumn());
        self::assertSame([], $queue->pending());

        $pdo->exec("UPDATE orders SET status = 'released'");
        $orders->saveAdministration($order, $order['items']);
        self::assertSame([], $queue->pending());
    }

    public function testBatchDeliversPendingAcceptanceAndRecordsTheSentMarker(): void
    {
        [$pdo, $orders, $order] = $this->fixture();
        $orders->saveAdministration($order, $order['items']);
        $pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES ('retention', 'registration_token_retention_days', '\"365\"', '[\"admin\"]', '[\"admin\"]', 'Retention')");
        $emails = new RecordingEmailSender();
        $batch = new OrderBatchService($orders, new EmailQueueRepository($pdo), new FrontendConfigRepository($pdo), $emails, new RegistrationTokenRepository($pdo), new ExternalErrorLogRepository($pdo));
        $emails->failStoredEmail = true;
        self::assertSame(1, $batch->run()['failed']);
        self::assertNull($pdo->query('SELECT acceptance_email_sent_at FROM orders')->fetchColumn());
        $emails->failStoredEmail = false;
        self::assertSame(1, $batch->run()['sent']);
        self::assertSame(0, $batch->run()['sent']);
        self::assertCount(1, $emails->orderConfirmations);
        self::assertSame('definitive', json_decode($emails->orderConfirmations[0]['order']['html'], true)['renderedMailStatus']);
        self::assertNotNull($pdo->query('SELECT acceptance_email_sent_at FROM orders')->fetchColumn());
    }

    public function testPendingAcceptanceIsCancelledIfTheOrderIsNoLongerDefinitive(): void
    {
        [$pdo, $orders, $order] = $this->fixture();
        $orders->saveAdministration($order, $order['items']);
        $pdo->exec("UPDATE orders SET status = 'changes_requested'");
        $never = static fn () => self::fail('Outdated acceptance must not be sent.');
        self::assertSame('not_required', $orders->deliverAcceptanceNotification($order['id'], $never, $never));
        self::assertSame([], (new EmailQueueRepository($pdo))->pending());
        self::assertNull($pdo->query('SELECT acceptance_email_sent_at FROM orders')->fetchColumn());
    }

    private function fixture(): array
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('acceptance@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $order = $orders->saveForYear($user['id'], 2026, 'released', 1, 0, [['category' => 'gift', 'description' => 'A warm coat', 'reason' => 'Winter']]);
        $order['status'] = 'definitive';
        $order['items'] = array_map(static fn (array $item): array => [...$item, 'publicationStatus' => 'approved'], $order['items']);
        return [$pdo, $orders, $order];
    }
}
