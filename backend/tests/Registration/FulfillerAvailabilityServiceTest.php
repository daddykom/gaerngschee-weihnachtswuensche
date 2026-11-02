<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\FulfillerAvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class FulfillerAvailabilityServiceTest extends TestCase
{
    public function testKeepsFulfillerAccessOpenAtTheConfiguredLimits(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '999999', '2');
        $this->addOrder($pdo, 'order-1');
        $this->addItem($pdo, 'item-1', 'order-1');
        $this->addItem($pdo, 'item-2', 'order-1');

        $status = (new FulfillerAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('open', $status);
    }

    public function testEndsFulfillerAccessWhenTheOrderItemLimitIsExceeded(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '999999', '1');
        $this->addOrder($pdo, 'order-1');
        $this->addItem($pdo, 'item-1', 'order-1');
        $this->addItem($pdo, 'item-2', 'order-1');

        $status = (new FulfillerAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('ended', $status);
    }

    public function testEndsFulfillerAccessWhenTheOrderLimitIsExceeded(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '1', '999999');
        $this->addOrder($pdo, 'order-1');
        $this->addOrder($pdo, 'order-2');

        $status = (new FulfillerAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('ended', $status);
    }

    private function addConfiguration(\PDO $pdo, string $maximumOrders, string $maximumItems): void
    {
        foreach ([
            ['campaign-year', 'campaign_year', '2026'],
            ['fulfiller-start', 'fulfiller_start_date', '2026-01-01'],
            ['fulfiller-end', 'fulfiller_end_date', '2026-12-31'],
            ['maximum-orders', 'maximum_orders_per_year', $maximumOrders],
            ['maximum-items', 'maximum_order_items_per_year', $maximumItems],
        ] as [$id, $variableName, $value]) {
            $pdo->prepare(
                'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([
                $id,
                $variableName,
                json_encode($value, JSON_THROW_ON_ERROR),
                '["admin", "wunschbesteller"]',
                '["admin"]',
                $variableName,
            ]);
        }
    }

    private function addOrder(\PDO $pdo, string $id): void
    {
        $pdo->prepare(
            'INSERT INTO orders (id, user_id, year, status) VALUES (?, ?, 2026, ?)',
        )->execute([$id, 'user-' . $id, 'definitive']);
    }

    private function addItem(\PDO $pdo, string $id, string $orderId): void
    {
        $pdo->prepare(
            "INSERT INTO order_items
                (id, order_id, original_description, current_description, status, publication_status, fulfillment_status)
             VALUES (?, ?, 'Wunsch', 'Wunsch', 'approved', 'approved', 'available')",
        )->execute([$id, $orderId]);
    }

    private function date(string $date): DateTimeImmutable
    {
        return new DateTimeImmutable($date . ' 12:00:00', new DateTimeZone('UTC'));
    }
}
