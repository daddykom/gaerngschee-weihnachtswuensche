<?php

declare(strict_types=1);

namespace App\Registration\Data;

use PDO;

final class GiftReceiptRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return array<string, mixed>|null */
    public function findByNumber(int $year, int $orderNumber, int $itemNumber): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT orders.id, orders.year, orders.order_number, orders.status, items.id AS selected_item_id
             FROM orders INNER JOIN order_items items ON items.order_id = orders.id
             WHERE orders.year = :year AND orders.order_number = :order_number AND items.item_number = :item_number',
        );
        $statement->execute(['year' => $year, 'order_number' => $orderNumber, 'item_number' => $itemNumber]);
        $order = $statement->fetch();
        if (!is_array($order)) {
            return null;
        }

        $items = $this->pdo->prepare(
            'SELECT id, item_number, category, current_title, current_description,
                    publication_status, fulfillment_status, received_at
             FROM order_items WHERE order_id = :order_id ORDER BY item_number, id',
        );
        $items->execute(['order_id' => $order['id']]);

        return [
            'selectedItemId' => (string) $order['selected_item_id'],
            'order' => [
                'id' => (string) $order['id'],
                'year' => (int) $order['year'],
                'orderNumber' => (int) $order['order_number'],
                'status' => (string) $order['status'],
                'items' => array_map(static fn (array $item): array => [
                    'id' => (string) $item['id'],
                    'itemNumber' => $item['item_number'] === null ? null : (int) $item['item_number'],
                    'giftNumber' => $item['item_number'] === null ? null : $orderNumber . '-' . $item['item_number'],
                    'category' => (string) $item['category'],
                    'currentTitle' => (string) $item['current_title'],
                    'currentDescription' => (string) $item['current_description'],
                    'publicationStatus' => (string) $item['publication_status'],
                    'fulfillmentStatus' => (string) $item['fulfillment_status'],
                    'receivedAt' => $item['received_at'],
                ], $items->fetchAll()),
            ],
        ];
    }
}
