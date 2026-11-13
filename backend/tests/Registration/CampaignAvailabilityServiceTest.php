<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Services\CampaignAvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class CampaignAvailabilityServiceTest extends TestCase
{
    public function testStaysOpenBelowTheConfiguredLimits(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '999999', '3');
        $this->addOrder($pdo, 'order-1');
        $this->addItem($pdo, 'item-1', 'order-1');
        $this->addItem($pdo, 'item-2', 'order-1');

        $status = (new CampaignAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('open', $status);
    }

    public function testReportsCapacityReachedWhenTheOrderItemLimitIsExceeded(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '999999', '1');
        $this->addOrder($pdo, 'order-1');
        $this->addItem($pdo, 'item-1', 'order-1');
        $this->addItem($pdo, 'item-2', 'order-1');

        $status = (new CampaignAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('capacity_reached', $status);
    }

    public function testReportsCapacityReachedWhenTheOrderLimitIsExceeded(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '1', '999999');
        $this->addOrder($pdo, 'order-1');
        $this->addOrder($pdo, 'order-2');

        $status = (new CampaignAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('capacity_reached', $status);
    }

    public function testCountsDraftOrdersTowardsTheCapacity(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '1', '999999');
        $this->addOrder($pdo, 'order-1', 'draft');

        $status = (new CampaignAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('capacity_reached', $status);
    }

    public function testDateStatusTakesPrecedenceOverTheCapacity(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '999999', '1', '2026-01-01', '2026-08-31');
        $this->addOrder($pdo, 'order-1');
        $this->addItem($pdo, 'item-1', 'order-1');
        $this->addItem($pdo, 'item-2', 'order-1');

        $status = (new CampaignAvailabilityService($pdo))->status($this->date('2026-09-01'));

        self::assertSame('ended', $status);
    }

    public function testIsCapacityReachedIsFalseWhileTheLimitsAreNotReached(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '2', '2');
        $this->addOrder($pdo, 'order-1');
        $this->addItem($pdo, 'item-1', 'order-1');

        self::assertFalse((new CampaignAvailabilityService($pdo))->isCapacityReached());
    }

    private function addConfiguration(
        \PDO $pdo,
        string $maximumOrders,
        string $maximumItems,
        string $endDate = '2026-12-31',
    ): void {
        foreach ([
            ['campaign-year', 'campaign_year', '2026'],
            ['campaign-start', 'campaign_start_date', '2026-01-01'],
            ['campaign-end', 'campaign_end_date', $endDate],
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

    private function addOrder(\PDO $pdo, string $id, string $status = 'definitive'): void
    {
        $pdo->prepare(
            'INSERT INTO orders (id, user_id, year, status) VALUES (?, ?, 2026, ?)',
        )->execute([$id, 'user-' . $id, $status]);
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
