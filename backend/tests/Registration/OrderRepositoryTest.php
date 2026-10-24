<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Data\OrderRepository;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class OrderRepositoryTest extends TestCase
{
    public function testSavesOrderItemsWithCategoryAndCurrentValues(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('items@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);

        $order = $orders->saveForYear(
            $user['id'],
            2026,
            'draft',
            1,
            1,
            [[
                'category' => 'gift',
                'description' => 'Ein Geschenk',
                'reason' => 'Das wäre schön.',
            ]],
        );

        self::assertCount(1, $order['items']);
        self::assertSame('gift', $order['items'][0]['category']);
        self::assertSame('Ein Geschenk', $order['items'][0]['originalDescription']);
        self::assertSame('Ein Geschenk', $order['items'][0]['currentDescription']);
        self::assertSame('Das wäre schön.', $order['items'][0]['originalReason']);
        self::assertSame('Das wäre schön.', $order['items'][0]['currentReason']);
        self::assertSame('submitted', $order['items'][0]['status']);
    }
}
