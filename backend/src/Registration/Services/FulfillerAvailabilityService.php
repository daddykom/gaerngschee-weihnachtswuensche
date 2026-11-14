<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Configuration\Data\FrontendConfigRepository;
use DateTimeImmutable;
use PDO;

final class FulfillerAvailabilityService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly ?FrontendConfigRepository $configs = null,
    ) {
    }

    /**
     * Fulfillers are gated by the configured date range only; capacity limits
     * apply exclusively to new registrations and new orders.
     */
    public function status(?DateTimeImmutable $now = null): string
    {
        $configs = $this->configs ?? new FrontendConfigRepository($this->pdo);

        return $configs->fulfillerStatus($now);
    }
}
