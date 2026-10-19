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
            'SELECT id, user_id, year, status, adults_count, children_count,
                    fairgate_status, confirmation_email_sent_at, fairgate_reminder_email_sent_at,
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
            'fairgateStatus' => $order['fairgate_status'],
            'confirmationEmailSentAt' => $order['confirmation_email_sent_at'],
            'fairgateReminderEmailSentAt' => $order['fairgate_reminder_email_sent_at'],
            'createdAt' => $order['created_at'],
            'updatedAt' => $order['updated_at'],
        ];
    }

    /** @return list<array{orderId: string, email: string, year: int, status: string, adultsCount: int, childrenCount: int, fairgateStatus: ?string, createdAt: ?string}> */
    public function findAllForFairgatePersonCountCheck(?int $year = null): array
    {
        $query = 'SELECT orders.id, users.email, orders.year, orders.status,
                         orders.adults_count, orders.children_count,
                         orders.fairgate_status, orders.created_at
                  FROM orders INNER JOIN users ON users.id = orders.user_id
                  WHERE orders.status = \'definitive\'';
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
    public function findProvisionalWithUsers(): array
    {
        $statement = $this->pdo->query(
            "SELECT orders.id, orders.user_id, users.email FROM orders
             INNER JOIN users ON users.id = orders.user_id
             WHERE orders.status = 'provisional' ORDER BY orders.created_at, orders.id",
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
             updated_at = CURRENT_TIMESTAMP WHERE id = :id AND status = 'provisional'",
        );
        $statement->execute(['id' => $orderId, 'adults_count' => $adultsCount, 'children_count' => $childrenCount]);
    }

    public function markBatchEmailSent(string $orderId): void
    {
        $statement = $this->pdo->prepare(
            "UPDATE orders SET status = 'definitive', confirmation_email_sent_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP WHERE id = :id AND status = 'provisional'",
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
    public function saveForYear(string $userId, int $year, string $status, int $adultsCount, int $childrenCount, array $items = [], ?string $fairgateStatus = null): array
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
                     fairgate_status = :fairgate_status, confirmation_email_sent_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = :id',
                );
                $update->execute(['id' => $orderId, 'status' => $status, 'adults_count' => $adultsCount, 'children_count' => $childrenCount, 'fairgate_status' => $fairgateStatus]);
            } else {
                $insert = $this->pdo->prepare(
                    'INSERT INTO orders (id, user_id, year, status, adults_count, children_count, fairgate_status)
                     VALUES (:id, :user_id, :year, :status, :adults_count, :children_count, :fairgate_status)',
                );
                $insert->execute(['id' => $orderId, 'user_id' => $userId, 'year' => $year, 'status' => $status, 'adults_count' => $adultsCount, 'children_count' => $childrenCount, 'fairgate_status' => $fairgateStatus]);
                $this->recordStatusChanges(1);
            }
            $this->pdo->commit();
        } catch (\Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
        return $this->findForYear($userId, $year) ?? throw new \RuntimeException('Order was not saved.');
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
