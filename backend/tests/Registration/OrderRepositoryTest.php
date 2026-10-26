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

    public function testAdministrationFiltersByStatusAndCategoryAndSavesApproval(): void
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('admin-order@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $saved = $orders->saveForYear($user['id'], 2026, 'released', 1, 1, [[
            'category' => 'gift', 'description' => 'Spiel', 'reason' => 'Wunsch',
        ]], null, 'Familientext');

        $filtered = $orders->findForAdministration(['released'], ['gift']);
        self::assertCount(1, $filtered);
        self::assertSame($saved['id'], $filtered[0]['id']);

        $updated = $orders->saveAdministration([
            'id' => $saved['id'],
            'status' => 'definitive',
            'currentText' => 'Korrigierter Text',
            'adminNotes' => 'Geprüft',
            'adultsCount' => 1,
            'childrenCount' => 1,
        ], [[
            'id' => $saved['items'][0]['id'],
            'currentDescription' => 'Korrigiertes Spiel',
            'currentReason' => 'Korrigierter Wunsch',
            'publicationStatus' => 'approved',
            'adminNotes' => null,
        ]]);

        self::assertSame('definitive', $updated['status']);
        self::assertSame('Korrigiertes Spiel', $updated['items'][0]['currentDescription']);
        self::assertSame('approved', $updated['items'][0]['publicationStatus']);
        self::assertSame('Spiel', $updated['items'][0]['originalDescription']);
    }
}
