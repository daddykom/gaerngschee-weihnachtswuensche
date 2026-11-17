<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Data\OrderRepository;
use App\Registration\Data\OrderStatisticsRepository;
use App\Registration\Services\OrderStatus;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class OrderStatisticsRepositoryTest extends TestCase
{
    public function testCountsAllStatusesAndCategoriesOnceWithinTheSelectedYearWithoutChangingData(): void
    {
        $pdo = TestDatabase::create();
        $users = new UserRepository($pdo);
        $orders = new OrderRepository($pdo);
        $fulfillmentStatuses = ['available', 'pending_confirmation', 'reserved', 'received', 'completed', 'available', 'reserved'];
        $publicationStatuses = ['draft', 'submitted', 'rejected', 'approved'];
        foreach (OrderStatus::all() as $index => $status) {
            $user = $users->createUser('statistics-' . $index . '@example.com', 'secret', 'wunschbesteller');
            $items = [['category' => 'gift', 'description' => 'Gift', 'reason' => 'Winter']];
            if ($index === 0) {
                $items[] = ['category' => 'voucher', 'description' => 'Voucher', 'reason' => 'Winter'];
            }
            $order = $orders->saveForYear($user['id'], 2026, $status, 1, 0, $items);
            $pdo->prepare('UPDATE order_items SET fulfillment_status = ?, publication_status = ? WHERE id = ?')->execute([
                $fulfillmentStatuses[$index], $publicationStatuses[$index % count($publicationStatuses)], $order['items'][0]['id'],
            ]);
        }
        $emptyUser = $users->createUser('statistics-empty@example.com', 'secret', 'wunschbesteller');
        $orders->saveForYear($emptyUser['id'], 2026, 'draft', 1, 0, []);
        $otherYear = $orders->saveForYear($emptyUser['id'], 2025, 'definitive', 1, 0, [['category' => 'gift', 'description' => 'Old gift']]);
        $pdo->prepare("UPDATE order_items SET fulfillment_status = 'pending_confirmation' WHERE order_id = ?")->execute([$otherYear['id']]);
        $beforeOrders = $pdo->query('SELECT * FROM orders ORDER BY id')->fetchAll();
        $beforeItems = $pdo->query('SELECT * FROM order_items ORDER BY id')->fetchAll();

        self::assertSame([
            'year' => 2026, 'orderCount' => 8, 'wishCount' => 8, 'availableCount' => 3,
            'pendingConfirmationCount' => 1, 'reservedCount' => 2, 'receivedCount' => 1, 'completedCount' => 1,
        ], (new OrderStatisticsRepository($pdo))->forYear(2026));
        self::assertSame($beforeOrders, $pdo->query('SELECT * FROM orders ORDER BY id')->fetchAll());
        self::assertSame($beforeItems, $pdo->query('SELECT * FROM order_items ORDER BY id')->fetchAll());
    }

    public function testReturnsIntegerZeroCountsForAnEmptyYear(): void
    {
        self::assertSame([
            'year' => 2042, 'orderCount' => 0, 'wishCount' => 0, 'availableCount' => 0,
            'pendingConfirmationCount' => 0, 'reservedCount' => 0, 'receivedCount' => 0, 'completedCount' => 0,
        ], (new OrderStatisticsRepository(TestDatabase::create()))->forYear(2042));
    }

    public function testCountsAvailableWishesRegardlessOfPublicationStatus(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('available-statistics@example.com', 'secret', 'wunschbesteller');
        $order = (new OrderRepository($pdo))->saveForYear($user['id'], 2026, 'draft', 1, 0, [
            ['category' => 'gift', 'description' => 'Available wish'],
        ]);
        foreach (['draft', 'submitted', 'rejected', 'approved'] as $publicationStatus) {
            $pdo->prepare("UPDATE order_items SET fulfillment_status = 'available', publication_status = ? WHERE order_id = ?")->execute([$publicationStatus, $order['id']]);
            self::assertSame(1, (new OrderStatisticsRepository($pdo))->forYear(2026)['availableCount'], $publicationStatus);
        }
    }
}
