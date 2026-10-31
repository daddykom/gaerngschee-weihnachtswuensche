<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Data\OrderRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class FulfillerOrderRepositoryTest extends TestCase
{
    public function testFindsDefinitiveOrdersGroupedWithWishNumbersAndSearchesCorrectedTexts(): void
    {
        $pdo = TestDatabase::create();
        $this->insertOrder($pdo, 'order-1', 'definitive', 12, 'Anonymisierte Familie');
        $this->insertItem($pdo, 'item-1', 'order-1', 1, 'gift', 'Bauklötze', 'Zum gemeinsamen Bauen');
        $this->insertItem($pdo, 'item-2', 'order-1', 2, 'voucher', 'Gutschein', 'Für einen Ausflug');
        $this->insertOrder($pdo, 'order-2', 'released', 13, 'Andere Familie');
        $this->insertItem($pdo, 'item-3', 'order-2', 1, 'gift', 'Nicht anzeigen', null);

        $orders = (new OrderRepository($pdo))->findForFulfiller('fulfiller@example.com', 'Bau', null);

        self::assertCount(1, $orders);
        self::assertSame(12, $orders[0]['orderNumber']);
        self::assertSame('Anonymisierte Familie', $orders[0]['currentText']);
        self::assertSame('12-1', $orders[0]['items'][0]['wishNumber']);
        self::assertSame('Bauklötze', $orders[0]['items'][0]['currentDescription']);
    }

    public function testFiltersByCategoryAndAllowsOwnReservationToRemainVisible(): void
    {
        $pdo = TestDatabase::create();
        $this->insertOrder($pdo, 'order-1', 'definitive', 12, 'Familie');
        $this->insertItem($pdo, 'item-1', 'order-1', 1, 'gift', 'Geschenk', null);
        $this->insertItem($pdo, 'item-2', 'order-1', 2, 'voucher', 'Gutschein', null);

        $repository = new OrderRepository($pdo);
        $reserved = $repository->reserveItemForFulfiller('item-1', 'Fulfiller@Example.com');

        self::assertNotNull($reserved);
        self::assertSame('reserved', $reserved['fulfillmentStatus']);
        self::assertSame('fulfiller@example.com', $pdo->query("SELECT fulfiller_email FROM order_items WHERE id = 'item-1'")->fetchColumn());
        self::assertNull($repository->reserveItemForFulfiller('item-1', 'other@example.com'));

        $orders = $repository->findForFulfiller('fulfiller@example.com', null, 'gift');

        self::assertCount(1, $orders);
        self::assertCount(1, $orders[0]['items']);
        self::assertSame('reserved', $orders[0]['items'][0]['fulfillmentStatus']);
    }

    private function insertOrder(\PDO $pdo, string $id, string $status, int $orderNumber, string $text): void
    {
        $statement = $pdo->prepare(
            'INSERT INTO orders (id, user_id, year, status, order_number, current_text) VALUES (?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([$id, 'user-' . $id, 2026, $status, $orderNumber, $text]);
    }

    private function insertItem(
        \PDO $pdo,
        string $id,
        string $orderId,
        int $itemNumber,
        string $category,
        string $description,
        ?string $reason,
    ): void {
        $statement = $pdo->prepare(
            "INSERT INTO order_items
             (id, order_id, item_number, category, original_description, current_description, current_reason,
              status, publication_status, fulfillment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'approved', 'available')",
        );
        $statement->execute([$id, $orderId, $itemNumber, $category, $description, $description, $reason]);
    }
}
