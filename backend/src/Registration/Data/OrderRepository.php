<?php

declare(strict_types=1);

namespace App\Registration\Data;

use App\Shared\Events\EventRepository;
use PDO;

final class OrderRepository
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly ?EventRepository $events = null,
    ) {
    }

    /** @return array<string, mixed>|null */
    public function findForYear(string $userId, int $year): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, user_id, year, status, adults_count, children_count, original_text, current_text,
                    admin_notes, fairgate_adults_count, fairgate_children_count, processing_year,
                    released_at, definitive_at, fairgate_status, confirmation_email_sent_at, fairgate_reminder_email_sent_at,
                    created_at, updated_at
             FROM orders WHERE user_id = :user_id AND year = :year',
        );
        $statement->execute(['user_id' => $userId, 'year' => $year]);
        $order = $statement->fetch();
        if (!is_array($order)) {
            return null;
        }

        return [
            'id' => $order['id'],
            'userId' => $order['user_id'],
            'year' => (int) $order['year'],
            'status' => $order['status'],
            'adultsCount' => (int) $order['adults_count'],
            'childrenCount' => (int) $order['children_count'],
            'originalText' => $order['original_text'],
             'currentText' => $order['current_text'],
            'adminNotes' => $order['admin_notes'],
            'fairgateAdultsCount' => $order['fairgate_adults_count'] === null ? null : (int) $order['fairgate_adults_count'],
            'fairgateChildrenCount' => $order['fairgate_children_count'] === null ? null : (int) $order['fairgate_children_count'],
            'processingYear' => $order['processing_year'] === null ? null : (int) $order['processing_year'],
            'releasedAt' => $order['released_at'],
            'definitiveAt' => $order['definitive_at'],
            'items' => $this->findItems((string) $order['id']),
            'fairgateStatus' => $order['fairgate_status'],
            'confirmationEmailSentAt' => $order['confirmation_email_sent_at'],
            'fairgateReminderEmailSentAt' => $order['fairgate_reminder_email_sent_at'],
            'createdAt' => $order['created_at'],
            'updatedAt' => $order['updated_at'],
        ];
    }

    /** @return list<array<string, mixed>> */
    public function findItems(string $orderId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, order_id, category, original_description, current_description,
                    original_reason, current_reason, status, publication_status, fulfillment_status, admin_notes, fulfiller_email,
                    reserved_at, due_at, received_at, created_at, updated_at
             FROM order_items WHERE order_id = :order_id ORDER BY created_at, id',
        );
        $statement->execute(['order_id' => $orderId]);

        return array_map(static fn (array $item): array => [
            'id' => (string) $item['id'],
            'orderId' => (string) $item['order_id'],
            'category' => (string) $item['category'],
            'originalDescription' => (string) $item['original_description'],
            'currentDescription' => (string) $item['current_description'],
            'originalReason' => $item['original_reason'],
            'currentReason' => $item['current_reason'],
            'status' => (string) $item['status'],
            'publicationStatus' => (string) ($item['publication_status'] ?? $item['status']),
            'fulfillmentStatus' => (string) ($item['fulfillment_status'] ?? 'available'),
            'adminNotes' => $item['admin_notes'] ?? null,
            'fulfillerEmail' => $item['fulfiller_email'],
            'reservedAt' => $item['reserved_at'],
            'dueAt' => $item['due_at'],
            'receivedAt' => $item['received_at'],
            'createdAt' => $item['created_at'],
            'updatedAt' => $item['updated_at'],
        ], $statement->fetchAll());
    }

    /** @return list<array<string, mixed>> */
    public function findForAdministration(array $statuses, array $categories): array
    {
        $parameters = [];
        $conditions = [];
        if ($statuses !== []) {
            $placeholders = [];
            foreach (array_values($statuses) as $index => $status) {
                $key = 'status_' . $index;
                $placeholders[] = ':' . $key;
                $parameters[$key] = $status;
            }
            $conditions[] = 'orders.status IN (' . implode(', ', $placeholders) . ')';
        }
        if ($categories !== []) {
            $placeholders = [];
            foreach (array_values($categories) as $index => $category) {
                $key = 'category_' . $index;
                $placeholders[] = ':' . $key;
                $parameters[$key] = $category;
            }
            $conditions[] = 'EXISTS (SELECT 1 FROM order_items filter_items WHERE filter_items.order_id = orders.id AND filter_items.category IN (' . implode(', ', $placeholders) . '))';
        }
        $where = $conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions);
        $statement = $this->pdo->prepare(
            'SELECT orders.id, orders.user_id, users.email, orders.year, orders.status,
                    orders.adults_count, orders.children_count, orders.original_text, orders.current_text,
                    orders.admin_notes, orders.created_at, orders.updated_at
             FROM orders INNER JOIN users ON users.id = orders.user_id
             ' . $where . ' ORDER BY orders.created_at, orders.id',
        );
        $statement->execute($parameters);
        $orders = [];
        foreach ($statement->fetchAll() as $row) {
            $orders[] = [
                'id' => (string) $row['id'],
                'userId' => (string) $row['user_id'],
                'requesterEmail' => (string) $row['email'],
                'year' => (int) $row['year'],
                'status' => (string) $row['status'],
                'adultsCount' => (int) $row['adults_count'],
                'childrenCount' => (int) $row['children_count'],
                'originalText' => $row['original_text'],
                'currentText' => $row['current_text'],
                'adminNotes' => $row['admin_notes'],
                'items' => $this->findItems((string) $row['id']),
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at'],
            ];
        }
        return $orders;
    }

    /** @param array<string, mixed> $order @param list<array<string, mixed>> $items */
    public function saveAdministration(array $order, array $items): array
    {
        $this->pdo->beginTransaction();
        try {
            $statement = $this->pdo->prepare(
                'UPDATE orders SET current_text = :current_text, admin_notes = :admin_notes,
                 adults_count = :adults_count, children_count = :children_count,
                 status = :status, definitive_at = CASE WHEN :status = \'definitive\' THEN COALESCE(definitive_at, CURRENT_TIMESTAMP) ELSE definitive_at END,
                 updated_at = CURRENT_TIMESTAMP WHERE id = :id',
            );
            $statement->execute([
                'id' => $order['id'],
                'current_text' => $order['currentText'] ?? null,
                'admin_notes' => $order['adminNotes'] ?? null,
                'adults_count' => $order['adultsCount'] ?? 0,
                'children_count' => $order['childrenCount'] ?? 0,
                'status' => $order['status'],
            ]);
            foreach ($items as $item) {
                $itemStatement = $this->pdo->prepare(
                    'UPDATE order_items SET current_description = :description, current_reason = :reason,
                     publication_status = :publication_status, status = :status, admin_notes = :admin_notes,
                     updated_at = CURRENT_TIMESTAMP WHERE id = :id AND order_id = :order_id',
                );
                $itemStatement->execute([
                    'id' => $item['id'],
                    'order_id' => $order['id'],
                    'description' => $item['currentDescription'],
                    'reason' => $item['currentReason'] ?? null,
                    'publication_status' => $item['publicationStatus'],
                    'status' => $item['publicationStatus'],
                    'admin_notes' => $item['adminNotes'] ?? null,
                ]);
            }
            $this->pdo->commit();
        } catch (\Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
        $result = $this->findById((string) $order['id']);
        return $result ?? throw new \RuntimeException('Order was not saved.');
    }

    /** @return array<string, mixed>|null */
    public function findById(string $orderId): ?array
    {
        $statement = $this->pdo->prepare('SELECT user_id, year FROM orders WHERE id = :id');
        $statement->execute(['id' => $orderId]);
        $row = $statement->fetch();
        return is_array($row) ? $this->findForYear((string) $row['user_id'], (int) $row['year']) : null;
    }

    /** @return list<array{orderId: string, email: string, year: int, status: string, adultsCount: int, childrenCount: int, fairgateStatus: ?string, createdAt: ?string}> */
    public function findAllForFairgatePersonCountCheck(?int $year = null): array
    {
        $query = 'SELECT orders.id, users.email, orders.year, orders.status,
                         orders.adults_count, orders.children_count,
                         orders.fairgate_status, orders.created_at
                  FROM orders INNER JOIN users ON users.id = orders.user_id
                  WHERE orders.status IN (\'released\', \'in_review\', \'definitive\', \'ready_for_pickup\', \'completed\')';
        $parameters = [];
        if ($year !== null) {
            $query .= ' AND orders.year = :year';
            $parameters['year'] = $year;
        }
        $query .= ' ORDER BY orders.year, orders.id';
        $statement = $this->pdo->prepare($query);
        $statement->execute($parameters);

        return array_map(static fn (array $row): array => [
            'orderId' => (string) $row['id'],
            'email' => (string) $row['email'],
            'year' => (int) $row['year'],
            'status' => (string) $row['status'],
            'adultsCount' => (int) $row['adults_count'],
            'childrenCount' => (int) $row['children_count'],
            'fairgateStatus' => is_string($row['fairgate_status']) ? $row['fairgate_status'] : null,
            'createdAt' => is_string($row['created_at']) ? $row['created_at'] : null,
        ], $statement->fetchAll());
    }

    public function findStatusForEmailAndYear(string $email, int $year): ?string
    {
        $statement = $this->pdo->prepare(
            'SELECT orders.status FROM orders INNER JOIN users ON users.id = orders.user_id
             WHERE LOWER(users.email) = LOWER(:email) AND orders.year = :year',
        );
        $statement->execute(['email' => strtolower(trim($email)), 'year' => $year]);
        $status = $statement->fetchColumn();
        return $status === false ? null : (string) $status;
    }

    /** @return list<array{order: array<string, mixed>, email: string}> */
    public function findWaitingForFairgateWithUsers(): array
    {
        $statement = $this->pdo->query(
            "SELECT orders.id, orders.user_id, users.email FROM orders
             INNER JOIN users ON users.id = orders.user_id
              WHERE orders.status = 'waiting_for_fairgate' ORDER BY orders.created_at, orders.id",
        );
        $orders = [];
        foreach ($statement->fetchAll() as $row) {
            $order = $this->findForYear((string) $row['user_id'], (int) $this->findYear((string) $row['id']));
            if ($order !== null) {
                $orders[] = ['order' => $order, 'email' => (string) $row['email']];
            }
        }
        return $orders;
    }

    public function updateCountsFromBatch(string $orderId, int $adultsCount, int $childrenCount): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE orders SET adults_count = :adults_count, children_count = :children_count,
             fairgate_adults_count = :fairgate_adults_count, fairgate_children_count = :fairgate_children_count,
             updated_at = CURRENT_TIMESTAMP WHERE id = :id AND status = 'waiting_for_fairgate'",
        );
        $statement->execute(['id' => $orderId, 'adults_count' => $adultsCount, 'children_count' => $childrenCount, 'fairgate_adults_count' => $adultsCount, 'fairgate_children_count' => $childrenCount]);
    }

    public function markReleased(string $orderId): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE orders SET status = 'released', confirmation_email_sent_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP WHERE id = :id AND status = 'waiting_for_fairgate'",
        );
        $statement->execute(['id' => $orderId]);
        $this->recordStatusChanges($statement->rowCount());
    }

    public function markFairgateReminderSent(string $orderId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE orders SET fairgate_reminder_email_sent_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP WHERE id = :id',
        );
        $statement->execute(['id' => $orderId]);
    }

    /** @param list<array<string, mixed>> $items Kept for compatibility with historical callers. */
    public function saveForYear(string $userId, int $year, string $status, int $adultsCount, int $childrenCount, array $items = [], ?string $fairgateStatus = null, ?string $text = null): array
    {
        $this->pdo->beginTransaction();
        try {
            $find = $this->pdo->prepare('SELECT id, status FROM orders WHERE user_id = :user_id AND year = :year');
            $find->execute(['user_id' => $userId, 'year' => $year]);
            $existing = $find->fetch();
            $orderId = is_array($existing) ? (string) $existing['id'] : $this->createUuid();
            if (is_array($existing)) {
                $update = $this->pdo->prepare(
                    'UPDATE orders SET status = :status, adults_count = :adults_count, children_count = :children_count,
                      current_text = :current_text, fairgate_status = :fairgate_status,
                      released_at = CASE WHEN :released_status = \'released\' THEN COALESCE(released_at, CURRENT_TIMESTAMP) ELSE released_at END,
                      processing_year = COALESCE(processing_year, :processing_year), confirmation_email_sent_at = NULL,
                     updated_at = CURRENT_TIMESTAMP WHERE id = :id',
                );
                $update->execute(['id' => $orderId, 'status' => $status, 'released_status' => $status, 'processing_year' => $year, 'adults_count' => $adultsCount, 'children_count' => $childrenCount, 'current_text' => $text, 'fairgate_status' => $fairgateStatus]);
                if ((string) $existing['status'] !== $status) {
                    $this->recordStatusChanges(1);
                }
            } else {
                $insert = $this->pdo->prepare(
                    'INSERT INTO orders (id, user_id, year, status, adults_count, children_count, original_text, current_text, fairgate_status, processing_year, released_at)
                     VALUES (:id, :user_id, :year, :status, :adults_count, :children_count, :original_text, :current_text, :fairgate_status, :processing_year, CASE WHEN :released_status = \'released\' THEN CURRENT_TIMESTAMP ELSE NULL END)',
                );
                $insert->execute(['id' => $orderId, 'user_id' => $userId, 'year' => $year, 'status' => $status, 'released_status' => $status, 'processing_year' => $year, 'adults_count' => $adultsCount, 'children_count' => $childrenCount, 'original_text' => $text, 'current_text' => $text, 'fairgate_status' => $fairgateStatus]);
                $this->recordStatusChanges(1);
            }
            if ($items === [] || (isset($items[0]['category'], $items[0]['description'], $items[0]['reason']))) {
                $this->saveItems($orderId, $items);
            }
            $this->pdo->commit();
        } catch (\Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
        return $this->findForYear($userId, $year) ?? throw new \RuntimeException('Order was not saved.');
    }

    /** @param list<array{id?: string, category: string, description: string, reason: string}> $items */
    private function saveItems(string $orderId, array $items): void
    {
        $existing = $this->pdo->prepare('SELECT id FROM order_items WHERE order_id = :order_id');
        $existing->execute(['order_id' => $orderId]);
        $existingIds = array_map(static fn (array $row): string => (string) $row['id'], $existing->fetchAll());
        $submittedIds = [];

        foreach ($items as $item) {
            $itemId = isset($item['id']) && $item['id'] !== '' ? $item['id'] : $this->createUuid();
            $submittedIds[] = $itemId;
            if (in_array($itemId, $existingIds, true)) {
                $statement = $this->pdo->prepare(
                    'UPDATE order_items SET category = :category, current_description = :description,
                     current_reason = :reason, status = \'submitted\', updated_at = CURRENT_TIMESTAMP
                     WHERE id = :id AND order_id = :order_id',
                );
                $statement->execute([
                    'id' => $itemId,
                    'order_id' => $orderId,
                    'category' => $item['category'],
                    'description' => $item['description'],
                    'reason' => $item['reason'],
                ]);
                continue;
            }

            $statement = $this->pdo->prepare(
                'INSERT INTO order_items
                 (id, order_id, category, original_description, current_description, original_reason, current_reason, status)
                 VALUES (:id, :order_id, :category, :original_description, :current_description,
                         :original_reason, :current_reason, \'submitted\')',
            );
            $statement->execute([
                'id' => $itemId,
                'order_id' => $orderId,
                'category' => $item['category'],
                'original_description' => $item['description'],
                'current_description' => $item['description'],
                'original_reason' => $item['reason'],
                'current_reason' => $item['reason'],
            ]);
        }

        $delete = $this->pdo->prepare('DELETE FROM order_items WHERE order_id = :order_id AND id = :id');
        foreach (array_diff($existingIds, $submittedIds) as $itemId) {
            $delete->execute(['order_id' => $orderId, 'id' => $itemId]);
        }
    }

    public function markConfirmationEmailSent(string $orderId): void
    {
        $statement = $this->pdo->prepare('UPDATE orders SET confirmation_email_sent_at = CURRENT_TIMESTAMP WHERE id = :id');
        $statement->execute(['id' => $orderId]);
    }

    private function findYear(string $orderId): int
    {
        $statement = $this->pdo->prepare('SELECT year FROM orders WHERE id = :id');
        $statement->execute(['id' => $orderId]);
        return (int) $statement->fetchColumn();
    }

    private function recordStatusChanges(int $count): void
    {
        if ($count > 0) {
            ($this->events ?? new EventRepository($this->pdo))->increment('order-status-change', $count);
        }
    }

    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
