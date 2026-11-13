<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Configuration\Data\FrontendConfigRepository;
use DateTimeImmutable;
use PDO;

final class CampaignAvailabilityService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly ?FrontendConfigRepository $configs = null,
    ) {
    }

    public function status(?DateTimeImmutable $now = null): string
    {
        $configs = $this->configs ?? new FrontendConfigRepository($this->pdo);
        $dateStatus = $configs->campaignStatus($now);
        if ($dateStatus !== 'open') {
            return $dateStatus;
        }

        return $this->isCapacityReached() ? 'capacity_reached' : 'open';
    }

    /**
     * Capacity counts every order and wish of the campaign year, drafts included.
     * The limits only gate new registrations and new orders; existing orders may
     * always complete the wishes of their family members.
     */
    public function isCapacityReached(): bool
    {
        $configs = $this->configs ?? new FrontendConfigRepository($this->pdo);
        $year = $configs->findCampaignYear();
        $maximumOrders = $this->positiveConfiguration($configs, 'maximum_orders_per_year');
        $maximumOrderItems = $this->positiveConfiguration($configs, 'maximum_order_items_per_year');
        $counts = $this->countsForYear($year);

        return $counts['orders'] >= $maximumOrders || $counts['orderItems'] >= $maximumOrderItems;
    }

    /** @return array{orders: int, orderItems: int} */
    private function countsForYear(int $year): array
    {
        $orders = $this->pdo->prepare('SELECT COUNT(*) FROM orders WHERE year = :year');
        $orders->execute(['year' => $year]);

        $orderItems = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM order_items
             INNER JOIN orders ON orders.id = order_items.order_id
             WHERE orders.year = :year',
        );
        $orderItems->execute(['year' => $year]);

        return [
            'orders' => (int) $orders->fetchColumn(),
            'orderItems' => (int) $orderItems->fetchColumn(),
        ];
    }

    private function positiveConfiguration(FrontendConfigRepository $configs, string $variableName): int
    {
        $value = $configs->findValueByVariableName($variableName);
        if (!is_string($value) || !ctype_digit($value) || (int) $value < 1) {
            throw new \RuntimeException('Invalid ' . $variableName . ' configuration.');
        }

        return (int) $value;
    }
}
