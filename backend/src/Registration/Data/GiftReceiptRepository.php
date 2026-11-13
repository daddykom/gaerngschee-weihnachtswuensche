<?php

declare(strict_types=1);

namespace App\Registration\Data;

use PDO;
use App\Registration\Services\GiftReceiptException;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Events\EventRepository;

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

    /** @param callable(array): array{tokenHash: string, message: array} $notification */
    public function receive(int $year, int $orderNumber, int $itemNumber, bool $confirmUnreserved, bool $confirmPickup, callable $notification): array
    {
        $this->pdo->beginTransaction();
        try {
            $lock = $this->pdo->prepare('SELECT id, pickup_token_hash FROM orders WHERE year = ? AND order_number = ?' . $this->lockSuffix());
            $lock->execute([$year, $orderNumber]);
            $order = $lock->fetch();
            if (!is_array($order)) {
                throw new GiftReceiptException('GIFT_NOT_FOUND', 404);
            }
            $itemsLock = $this->pdo->prepare('SELECT id FROM order_items WHERE order_id = ? ORDER BY id' . $this->lockSuffix());
            $itemsLock->execute([$order['id']]);
            $itemsLock->fetchAll();
            $result = $this->findByNumber($year, $orderNumber, $itemNumber);
            if ($result === null) {
                throw new GiftReceiptException('GIFT_NOT_FOUND', 404);
            }
            $items = $result['order']['items'];
            $selected = array_values(array_filter($items, static fn (array $item): bool => $item['id'] === $result['selectedItemId']))[0];
            $alreadyReceived = in_array($selected['fulfillmentStatus'], ['received', 'completed'], true) && $selected['receivedAt'] !== null;
            if (!$alreadyReceived) {
                if ($result['order']['status'] !== 'definitive' || $selected['publicationStatus'] !== 'approved'
                    || !in_array($selected['fulfillmentStatus'], ['available', 'pending_confirmation', 'reserved'], true)
                    || $selected['receivedAt'] !== null) {
                    throw new GiftReceiptException('GIFT_NOT_RECEIVABLE');
                }
                $missing = array_filter($items, static fn (array $item): bool => $item['publicationStatus'] === 'approved'
                    && $item['id'] !== $selected['id']
                    && (!in_array($item['fulfillmentStatus'], ['received', 'completed'], true) || $item['receivedAt'] === null));
                $last = $missing === [];
                if (($selected['fulfillmentStatus'] !== 'reserved' && !$confirmUnreserved) || ($last && !$confirmPickup)) {
                    throw new GiftReceiptException('RECEIPT_CONFIRMATION_REQUIRED', 409, ['campaignYear' => $year, ...$result]);
                }
                if ($last && $order['pickup_token_hash'] !== null) {
                    throw new GiftReceiptException('GIFT_NOT_RECEIVABLE');
                }
                $this->pdo->prepare("UPDATE order_items SET fulfillment_status = 'received', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                    ->execute([$selected['id']]);
                (new EventRepository($this->pdo))->increment(FulfillerReservationRepository::AVAILABILITY_EVENT);
                if ($last) {
                    $mail = $notification($result['order']);
                    $this->pdo->prepare("UPDATE orders SET status = 'ready_for_pickup', pickup_token_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                        ->execute([$mail['tokenHash'], $order['id']]);
                    $recipient = $this->pdo->prepare('SELECT users.email FROM users INNER JOIN orders ON orders.user_id = users.id WHERE orders.id = ?');
                    $recipient->execute([$order['id']]);
                    (new EmailQueueRepository($this->pdo))->enqueue('order', $order['id'], 'pickup_notification', (string) $recipient->fetchColumn(), $mail['message'], '');
                    (new EventRepository($this->pdo))->increment('order-status-change');
                }
            }
            $updated = $this->findByNumber($year, $orderNumber, $itemNumber);
            $this->pdo->commit();
            return ['alreadyReceived' => $alreadyReceived, 'campaignYear' => $year, ...$updated];
        } catch (\Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    /** @param callable(array): void $send */
    public function deliverPickupNotification(string $orderId, callable $send): string
    {
        $this->pdo->beginTransaction();
        try {
            // The request and batch share this lock, so only one sender handles this order at a time.
            $order = $this->pdo->prepare('SELECT pickup_notification_sent_at FROM orders WHERE id = ?' . $this->lockSuffix());
            $order->execute([$orderId]);
            $row = $order->fetch();
            if (!is_array($row)) {
                $this->pdo->commit();
                return 'not_required';
            }
            if ($row['pickup_notification_sent_at'] !== null) {
                $this->pdo->commit();
                return 'sent';
            }
            $pending = $this->pdo->prepare("SELECT * FROM email_queue WHERE reference_type = 'order' AND reference_id = ? AND email_type = 'pickup_notification'");
            $pending->execute([$orderId]);
            $email = $pending->fetch();
            if (!is_array($email)) {
                $this->pdo->commit();
                return 'not_required';
            }
            try {
                $send($email);
            } catch (\Throwable) {
                (new EmailQueueRepository($this->pdo))->recordFailure($email['id'], 'Pickup notification delivery failed.');
                $this->pdo->commit();
                return 'pending';
            }
            $this->pdo->prepare('UPDATE orders SET pickup_notification_sent_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$orderId]);
            (new EmailQueueRepository($this->pdo))->remove($email['id']);
            $this->pdo->commit();
            return 'sent';
        } catch (\Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }

    private function lockSuffix(): string
    {
        return $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
    }
}
