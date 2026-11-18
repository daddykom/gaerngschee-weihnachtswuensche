<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\FulfillerReminderRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Registration\Services\FulfillerReminderService;
use App\Registration\Services\OrderBatchService;
use App\Shared\Logging\ExternalErrorLogRepository;
use App\Shared\Mail\EmailQueueRepository;
use DateTimeImmutable;
use PDO;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261117224627_add_fulfiller_reminder_schedule.php';

final class FulfillerReminderServiceTest extends TestCase
{
    private PDO $pdo;
    private FrontendConfigRepository $config;
    private RecordingEmailSender $emails;
    private FulfillerReminderService $service;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($this->pdo);
        $migration = new \AddFulfillerReminderSchedule('development', 20261117224627);
        $migration->setAdapter($adapter);
        $migration->up();
        $this->config = new FrontendConfigRepository($this->pdo);
        $this->emails = new RecordingEmailSender();
        $this->service = new FulfillerReminderService($this->config, new FulfillerReminderRepository($this->pdo), $this->emails);
        $insert = $this->pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ([
            'campaign_year' => '2026',
            'registration_token_retention_days' => '365',
            'fulfiller_handover_date' => '17.–19. Dezember 2026',
            'fulfiller_handover_time' => '10–12 Uhr',
            'fulfiller_handover_location' => "Saal A\nMusterstrasse 1",
        ] as $key => $value) {
            $insert->execute([$key, $key, json_encode($value), '["admin"]', '["admin"]', $key]);
        }
        $this->dates("2026-12-01\n2026-12-10");
        $this->pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES
            ('order-1', 'user-1', 2026, 'definitive', 179),
            ('order-2', 'user-2', 2026, 'definitive', 180),
            ('old-order', 'user-3', 2025, 'definitive', 1)");
    }

    public function testBundlesOnlyOutstandingWishesAndSendsOncePerRecipientAndDay(): void
    {
        $this->wish('open-1', 1, 'reserved', 'Fulfiller@example.com');
        $this->wish('open-2', 2, 'reserved', 'fulfiller@example.com', 'order-2');
        $this->wish('received', 3, 'received', 'fulfiller@example.com');
        $this->wish('completed', 4, 'completed', 'fulfiller@example.com');
        $this->wish('pending', 5, 'pending_confirmation', 'fulfiller@example.com');
        $this->wish('old', 6, 'reserved', 'fulfiller@example.com', 'old-order');
        $this->wish('other-recipient', 7, 'reserved', 'other@example.com');
        $this->wish('all-received', 8, 'received', 'done@example.com');
        $this->wish('timestamp', 9, 'reserved', 'fulfiller@example.com', receivedAt: '2026-11-30 12:00:00');
        $this->wish('not-approved', 10, 'reserved', 'fulfiller@example.com', publicationStatus: 'pending');
        $today = new DateTimeImmutable('2026-12-01T08:00:00+01:00');

        self::assertSame(['sent' => 2, 'failed' => 0], $this->service->run($today));
        self::assertSame(['sent' => 0, 'failed' => 0], $this->service->run($today->modify('+1 hour')));
        self::assertSame(['179-1', '180-2'], array_column($this->emails->fulfillerReminders[0]['wishes'], 'wishNumber'));
        self::assertSame('fulfiller@example.com', $this->emails->orderConfirmations[0]['recipient']);
        self::assertSame([
            'date' => '17.–19. Dezember 2026', 'time' => '10–12 Uhr', 'location' => "Saal A\nMusterstrasse 1",
        ], $this->emails->fulfillerReminders[0]['handover']);
        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM fulfiller_reminder_deliveries WHERE sent_at IS NOT NULL')->fetchColumn());

        self::assertSame(['sent' => 2, 'failed' => 0], $this->service->run(new DateTimeImmutable('2026-12-10T08:00:00+01:00')));
    }

    public function testFailedDeliveryIsRetriedWithFreshOutstandingWishes(): void
    {
        $this->wish('open', 1, 'reserved', 'fulfiller@example.com');
        $this->wish('received-later', 2, 'reserved', 'fulfiller@example.com');
        $now = new DateTimeImmutable('2026-12-01T08:00:00+01:00');
        $this->emails->failStoredEmail = true;
        self::assertSame(['sent' => 0, 'failed' => 1], $this->service->run($now));
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM fulfiller_reminder_deliveries')->fetchColumn());
        $this->pdo->exec("UPDATE order_items SET fulfillment_status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = 'received-later'");
        $this->emails->failStoredEmail = false;
        self::assertSame(['sent' => 1, 'failed' => 0], $this->service->run($now->modify('+1 hour')));
        self::assertSame(['179-1'], array_column($this->emails->fulfillerReminders[1]['wishes'], 'wishNumber'));
        self::assertCount(1, $this->emails->orderConfirmations);
    }

    #[DataProvider('scheduleCases')]
    public function testUsesExactIsoDatesAndSwissCalendarDay(string $dates, string $now, int $sent): void
    {
        $this->dates($dates);
        $this->wish('open', 1, 'reserved', 'fulfiller@example.com');
        self::assertSame(['sent' => $sent, 'failed' => 0], $this->service->run(new DateTimeImmutable($now)));
    }

    public static function scheduleCases(): array
    {
        return [
            'empty' => ['', '2026-12-01T12:00:00Z', 0],
            'past' => ['2026-11-30', '2026-12-01T12:00:00Z', 0],
            'future' => ['2026-12-02', '2026-12-01T12:00:00Z', 0],
            'wrong format' => ['01.12.2026', '2026-12-01T12:00:00Z', 0],
            'invalid date' => ['2026-02-30', '2026-03-02T12:00:00Z', 0],
            'duplicate and blank lines' => [" 2026-12-01 \r\n\r\n2026-12-01", '2026-12-01T12:00:00Z', 1],
            'Swiss midnight' => ['2026-12-01', '2026-11-30T23:00:00Z', 1],
            'before Swiss midnight' => ['2026-12-01', '2026-11-30T22:59:59Z', 0],
            'after Swiss day' => ['2026-12-01', '2026-12-01T23:00:00Z', 0],
            'Swiss daylight saving' => ['2026-06-01', '2026-05-31T22:00:00Z', 1],
        ];
    }

    public function testExistingOrderBatchInvokesRemindersAndReportsTheirDelivery(): void
    {
        $this->dates((new DateTimeImmutable('now', new \DateTimeZone('Europe/Zurich')))->format('Y-m-d'));
        $this->wish('open', 1, 'reserved', 'fulfiller@example.com');
        $batch = new OrderBatchService(
            new OrderRepository($this->pdo),
            new EmailQueueRepository($this->pdo),
            $this->config,
            $this->emails,
            new RegistrationTokenRepository($this->pdo),
            externalErrors: new ExternalErrorLogRepository($this->pdo),
            fulfillerReminders: $this->service,
        );
        self::assertSame(1, $batch->run()['sent']);
        self::assertSame(0, $batch->run()['sent']);
    }

    private function dates(string $dates): void
    {
        $this->config->update('639c9b3c-e7d6-4f12-b644-60d0519c51cd', 'admin', $dates);
    }

    private function wish(string $id, int $number, string $status, string $recipient, string $order = 'order-1', ?string $receivedAt = null, string $publicationStatus = 'approved'): void
    {
        $this->pdo->prepare('INSERT INTO order_items (id, order_id, item_number, current_title, current_description, original_description, status, publication_status, fulfillment_status, fulfiller_email, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$id, $order, $number, 'Title ' . $id, 'Description ' . $id, 'Internal original', 'approved', $publicationStatus, $status, $recipient, $receivedAt]);
    }
}
