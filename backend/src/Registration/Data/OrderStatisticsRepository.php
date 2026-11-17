<?php

declare(strict_types=1);

namespace App\Registration\Data;

use PDO;

final class OrderStatisticsRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return array{year: int, orderCount: int, wishCount: int, availableCount: int, pendingConfirmationCount: int, reservedCount: int, receivedCount: int, completedCount: int} */
    public function forYear(int $year): array
    {
        $statement = $this->pdo->prepare(
            "SELECT COUNT(DISTINCT orders.id) AS order_count, COUNT(items.id) AS wish_count,
                    COALESCE(SUM(CASE WHEN items.fulfillment_status = 'available' THEN 1 ELSE 0 END), 0) AS available_count,
                    COALESCE(SUM(CASE WHEN items.fulfillment_status = 'pending_confirmation' THEN 1 ELSE 0 END), 0) AS pending_confirmation_count,
                    COALESCE(SUM(CASE WHEN items.fulfillment_status = 'reserved' THEN 1 ELSE 0 END), 0) AS reserved_count,
                    COALESCE(SUM(CASE WHEN items.fulfillment_status = 'received' THEN 1 ELSE 0 END), 0) AS received_count,
                    COALESCE(SUM(CASE WHEN items.fulfillment_status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_count
             FROM orders LEFT JOIN order_items items ON items.order_id = orders.id
             WHERE orders.year = :year",
        );
        $statement->execute(['year' => $year]);
        $counts = $statement->fetch(PDO::FETCH_ASSOC);

        return [
            'year' => $year,
            'orderCount' => (int) $counts['order_count'],
            'wishCount' => (int) $counts['wish_count'],
            'availableCount' => (int) $counts['available_count'],
            'pendingConfirmationCount' => (int) $counts['pending_confirmation_count'],
            'reservedCount' => (int) $counts['reserved_count'],
            'receivedCount' => (int) $counts['received_count'],
            'completedCount' => (int) $counts['completed_count'],
        ];
    }
}
