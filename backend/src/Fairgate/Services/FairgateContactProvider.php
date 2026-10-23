<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

interface FairgateContactProvider
{
    public function hasContactByEmail(string $email): bool;

    /** @return array<string, mixed> */
    public function findContactDataByEmail(string $email, ?string $membership = null): array;
}
