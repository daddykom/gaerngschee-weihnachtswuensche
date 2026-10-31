<?php

declare(strict_types=1);

namespace App\Registration\Data;

use App\Shared\Events\EventRepository;
use DateTimeImmutable;
use PDO;

final class FulfillerReservationRepository
{
    public const AVAILABILITY_EVENT = 'fulfiller-wish-availability';

    public function __construct(
        private readonly PDO $pdo,
        private readonly ?EventRepository $events = null,
    ) {
    }

    public function releaseExpired(DateTimeImmutable $now): int
    {
        $statement = $this->pdo->prepare(
            "UPDATE order_items
             SET fulfillment_status = 'available', fulfiller_email = NULL, reserved_at = NULL,
                 reservation_expires_at = NULL, reservation_token_id = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE fulfillment_status = 'pending_confirmation'
               AND reservation_expires_at IS NOT NULL
               AND reservation_expires_at <= :now",
        );
        $statement->execute(['now' => $now->format('Y-m-d H:i:s')]);
        $count = $statement->rowCount();

        if ($count > 0) {
            ($this->events ?? new EventRepository($this->pdo))->increment(self::AVAILABILITY_EVENT, $count);
        }

        return $count;
    }

    public function reservePending(
        string $itemId,
        string $email,
        string $tokenId,
        DateTimeImmutable $expiresAt,
    ): bool {
        $statement = $this->pdo->prepare(
            "UPDATE order_items
             SET fulfillment_status = 'pending_confirmation', fulfiller_email = :email,
                 reservation_expires_at = :reservation_expires_at, reservation_token_id = :reservation_token_id,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND publication_status = 'approved' AND fulfillment_status = 'available'
               AND EXISTS (
                   SELECT 1 FROM orders
                   WHERE orders.id = order_items.order_id AND orders.status = 'definitive'
               )",
        );
        $statement->execute([
            'id' => $itemId,
            'email' => strtolower(trim($email)),
            'reservation_expires_at' => $expiresAt->format('Y-m-d H:i:s'),
            'reservation_token_id' => $tokenId,
        ]);

        if ($statement->rowCount() !== 1) {
            return false;
        }

        ($this->events ?? new EventRepository($this->pdo))->increment(self::AVAILABILITY_EVENT);

        return true;
    }

    public function confirmPending(string $itemId, string $tokenId, DateTimeImmutable $now): bool
    {
        $statement = $this->pdo->prepare(
            "UPDATE order_items
             SET fulfillment_status = 'reserved', reserved_at = CURRENT_TIMESTAMP,
                 reservation_expires_at = NULL, reservation_token_id = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND reservation_token_id = :reservation_token_id
               AND fulfillment_status = 'pending_confirmation'
               AND reservation_expires_at > :now",
        );
        $statement->execute([
            'id' => $itemId,
            'reservation_token_id' => $tokenId,
            'now' => $now->format('Y-m-d H:i:s'),
        ]);

        if ($statement->rowCount() !== 1) {
            return false;
        }

        ($this->events ?? new EventRepository($this->pdo))->increment(self::AVAILABILITY_EVENT);

        return true;
    }

    public function cancelPending(string $itemId, string $tokenId, DateTimeImmutable $now): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE order_items
             SET fulfillment_status = 'available', fulfiller_email = NULL, reservation_expires_at = NULL,
                 reservation_token_id = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND reservation_token_id = :reservation_token_id
               AND fulfillment_status = 'pending_confirmation'",
        );
        $statement->execute([
            'id' => $itemId,
            'reservation_token_id' => $tokenId,
        ]);

        if ($statement->rowCount() > 0) {
            ($this->events ?? new EventRepository($this->pdo))->increment(self::AVAILABILITY_EVENT);
        }
    }

    /** @return array<string, mixed>|null */
    public function findPublicWish(string $itemId): ?array
    {
        $statement = $this->pdo->prepare(
            "SELECT items.id, items.item_number, items.category, items.current_description, items.current_reason,
                    items.fulfillment_status, items.reserved_at, items.reservation_expires_at,
                    orders.id AS order_id, orders.year, orders.order_number
             FROM order_items items
             INNER JOIN orders ON orders.id = items.order_id
             WHERE items.id = :id AND items.publication_status = 'approved' AND orders.status = 'definitive'",
        );
        $statement->execute(['id' => $itemId]);
        $item = $statement->fetch();

        return is_array($item) ? $this->mapWish($item) : null;
    }

    /** @return list<array<string, mixed>> */
    public function findPublicOrders(?string $search = null, ?string $category = null): array
    {
        $conditions = [
            "orders.status = 'definitive'",
            "items.publication_status = 'approved'",
            "items.fulfillment_status IN ('available', 'pending_confirmation')",
        ];
        $parameters = [];

        if ($category !== null) {
            $conditions[] = 'items.category = :category';
            $parameters['category'] = $category;
        }
        if ($search !== null && trim($search) !== '') {
            $conditions[] = '(
                LOWER(COALESCE(orders.current_text, \'\')) LIKE :search_order
                OR LOWER(COALESCE(items.current_description, \'\')) LIKE :search_description
                OR LOWER(COALESCE(items.current_reason, \'\')) LIKE :search_reason
            )';
            $term = '%' . strtolower(trim($search)) . '%';
            $parameters['search_order'] = $term;
            $parameters['search_description'] = $term;
            $parameters['search_reason'] = $term;
        }

        $statement = $this->pdo->prepare(
            'SELECT orders.id, orders.year, orders.order_number, orders.current_text,
                    items.id AS item_id, items.item_number, items.category, items.current_description,
                    items.current_reason, items.fulfillment_status, items.reserved_at, items.reservation_expires_at
             FROM orders
             INNER JOIN order_items items ON items.order_id = orders.id
             WHERE ' . implode(' AND ', $conditions) . '
             ORDER BY orders.year DESC, orders.order_number ASC, items.item_number ASC, items.id ASC',
        );
        $statement->execute($parameters);

        $orders = [];
        foreach ($statement->fetchAll() as $row) {
            $orderId = (string) $row['id'];
            if (!isset($orders[$orderId])) {
                $orders[$orderId] = [
                    'id' => $orderId,
                    'year' => (int) $row['year'],
                    'orderNumber' => (int) $row['order_number'],
                    'currentText' => $row['current_text'],
                    'items' => [],
                ];
            }
            $orders[$orderId]['items'][] = $this->mapWish($row, 'item_id', $orderId);
        }

        return array_values($orders);
    }

    /** @return list<array{id: string, fulfillmentStatus: string, reservedAt: ?string, reservationExpiresAt: ?string}> */
    public function findPublicStatuses(): array
    {
        $statement = $this->pdo->query(
            "SELECT items.id, items.fulfillment_status, items.reserved_at, items.reservation_expires_at
             FROM order_items items
             INNER JOIN orders ON orders.id = items.order_id
             WHERE items.publication_status = 'approved' AND orders.status = 'definitive'
               AND items.fulfillment_status IN ('available', 'pending_confirmation', 'reserved')",
        );

        return array_map(static fn (array $item): array => [
            'id' => (string) $item['id'],
            'fulfillmentStatus' => (string) $item['fulfillment_status'],
            'reservedAt' => $item['reserved_at'],
            'reservationExpiresAt' => $item['reservation_expires_at'],
        ], $statement->fetchAll());
    }

    /** @return array<string, mixed> */
    private function mapWish(array $item, string $idKey = 'id', ?string $orderId = null): array
    {
        $resolvedOrderId = $orderId ?? (string) $item['order_id'];
        $orderNumber = (int) ($item['order_number'] ?? 0);

        return [
            'id' => (string) $item[$idKey],
            'orderId' => $resolvedOrderId,
            'year' => isset($item['year']) ? (int) $item['year'] : null,
            'orderNumber' => $orderNumber,
            'itemNumber' => (int) $item['item_number'],
            'wishNumber' => $orderNumber . '-' . (int) $item['item_number'],
            'category' => (string) $item['category'],
            'currentDescription' => (string) $item['current_description'],
            'currentReason' => $item['current_reason'],
            'fulfillmentStatus' => (string) $item['fulfillment_status'],
            'reservedAt' => $item['reserved_at'],
            'reservationExpiresAt' => $item['reservation_expires_at'] ?? null,
        ];
    }
}
