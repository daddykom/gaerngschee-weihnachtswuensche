<?php

declare(strict_types=1);

namespace App\Registration\Data;

use PDO;
use PDOException;
use Throwable;

final class FulfillerReminderRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return array<string, list<array<string, string>>> */
    public function findOutstandingWishes(int $year): array
    {
        $statement = $this->pdo->prepare(
            "SELECT items.fulfiller_email, items.item_number, items.current_title,
                    items.current_description, orders.order_number
             FROM order_items items INNER JOIN orders ON orders.id = items.order_id
             WHERE orders.year = :year AND orders.status = 'definitive'
               AND items.publication_status = 'approved'
               AND items.fulfillment_status = 'reserved' AND items.received_at IS NULL
               AND items.fulfiller_email IS NOT NULL
             ORDER BY orders.order_number, items.item_number",
        );
        $statement->execute(['year' => $year]);
        $recipients = [];
        foreach ($statement->fetchAll() as $row) {
            $email = strtolower(trim((string) $row['fulfiller_email']));
            if ($email === '') {
                continue;
            }
            $recipients[$email][] = [
                'wishNumber' => $row['order_number'] . '-' . $row['item_number'],
                'title' => (string) $row['current_title'],
                'currentDescription' => (string) $row['current_description'],
            ];
        }
        return $recipients;
    }

    /** @param callable(): void $send */
    public function deliverOnce(string $recipient, string $date, callable $send): bool
    {
        $this->pdo->beginTransaction();
        try {
            // The unique insert also serializes concurrent batches for this recipient and day.
            try {
                $statement = $this->pdo->prepare(
                    'INSERT INTO fulfiller_reminder_deliveries (id, recipient, notification_date)
                     VALUES (:id, :recipient, :date)',
                );
                $statement->execute([
                    'id' => $this->uuid(),
                    'recipient' => strtolower(trim($recipient)),
                    'date' => $date,
                ]);
            } catch (PDOException $exception) {
                $this->pdo->rollBack();
                if (($exception->errorInfo[1] ?? null) === 1062
                    || str_contains($exception->getMessage(), 'UNIQUE constraint failed: fulfiller_reminder_deliveries.')) {
                    return false;
                }
                throw $exception;
            }

            $send();
            $this->pdo->prepare(
                'UPDATE fulfiller_reminder_deliveries SET sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE recipient = :recipient AND notification_date = :date',
            )->execute(['recipient' => strtolower(trim($recipient)), 'date' => $date]);
            $this->pdo->commit();
            return true;
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $exception;
        }
    }

    private function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
