<?php

declare(strict_types=1);

namespace App\Registration\Data;

use App\Registration\Services\FulfillerReleaseException;
use App\Shared\Events\EventRepository;
use App\Shared\Mail\EmailQueueRepository;
use DateTimeImmutable;
use PDO;
use Throwable;

final class FulfillerReleaseRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @param array<string, mixed> $expected @param callable(array): array $render */
    public function release(string $orderId, string $itemId, array $expected, callable $render): array
    {
        $this->pdo->beginTransaction();
        try {
            // Use the same order-before-item lock order as gift receipt.
            $suffix = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
            $order = $this->pdo->prepare('SELECT id, order_number FROM orders WHERE id = ?' . $suffix);
            $order->execute([$orderId]);
            $order = $order->fetch();
            $query = $this->pdo->prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?' . $suffix);
            $query->execute([$itemId, $orderId]);
            $item = $query->fetch();
            if (!is_array($order) || !is_array($item)) {
                throw new FulfillerReleaseException('WISH_NOT_FOUND', 404);
            }
            if ($item['received_at'] !== null || in_array($item['fulfillment_status'], ['received', 'completed'], true)) {
                throw new FulfillerReleaseException('GIFT_ALREADY_RECEIVED', 409);
            }
            $current = [
                'fulfillerEmail' => $item['fulfiller_email'],
                'fulfillmentStatus' => $item['fulfillment_status'],
                'reservedAt' => $item['reserved_at'],
                'reservationExpiresAt' => $item['reservation_expires_at'],
            ];
            if (!$item['fulfiller_email']
                || !in_array($item['fulfillment_status'], ['pending_confirmation', 'reserved'], true)
                || $current !== $expected) {
                throw new FulfillerReleaseException('FULFILLER_CHANGED', 409);
            }
            $message = $render([
                'wishNumber' => $order['order_number'] . '-' . $item['item_number'],
                'title' => $item['current_title'],
                'currentDescription' => $item['current_description'],
            ]);
            if ($item['reservation_token_id'] !== null) {
                (new FulfillerReservationTokenRepository($this->pdo))->invalidate(
                    $item['reservation_token_id'],
                    new DateTimeImmutable(),
                );
            }
            $this->pdo->prepare(
                "UPDATE order_items SET fulfillment_status = 'available', fulfiller_email = NULL,
                 reserved_at = NULL, reservation_expires_at = NULL, reservation_token_id = NULL,
                 due_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            )->execute([$itemId]);
            $this->pdo->prepare(
                "DELETE FROM email_queue WHERE reference_type = 'fulfiller_reservation'
                 AND reference_id = ? AND email_type = 'fulfiller_reservation_confirmation' AND recipient = ?",
            )->execute([$itemId, $item['fulfiller_email']]);
            // Each release has its own reference, even when the same wish is reassigned later.
            (new EmailQueueRepository($this->pdo))->enqueue(
                'fulfiller_release',
                bin2hex(random_bytes(16)),
                'fulfiller_released',
                $item['fulfiller_email'],
                $message,
                '',
            );
            (new EventRepository($this->pdo))->increment(FulfillerReservationRepository::AVAILABILITY_EVENT);
            $saved = (new OrderRepository($this->pdo))->findById($orderId);
            $updated = array_values(array_filter($saved['items'], static fn (array $candidate): bool => $candidate['id'] === $itemId))[0];
            $this->pdo->commit();
            return $updated;
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }
    }
}
