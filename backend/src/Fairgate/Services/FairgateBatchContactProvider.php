<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

interface FairgateBatchContactProvider
{
    /** @return list<array{email: string, contactId: string}> */
    public function findAllContacts(string $membership): array;

    /** @return array<string, mixed> */
    public function findContactDataById(string $contactId): array;
}
