<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

use App\Fairgate\Data\FairgateContactRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;

final class FairgateContactSyncService
{
    /** @var Closure(): list<array{email: string, fairgate_contact_id: string}> */
    private readonly Closure $fetchContacts;

    /** @param callable(): list<array{email: string, fairgate_contact_id: string}> $fetchContacts */
    public function __construct(private readonly FairgateContactRepository $contacts, callable $fetchContacts)
    {
        $this->fetchContacts = Closure::fromCallable($fetchContacts);
    }

    /** @return array{read: int, inserted: int, updated: int, deleted: int} */
    public function run(?DateTimeImmutable $now = null): array
    {
        // Fetch every page before starting a database transaction.
        $snapshot = ($this->fetchContacts)();
        if ($snapshot === []) {
            throw new FairgateException('Refusing to synchronize an empty Fairgate contact snapshot.');
        }

        return $this->contacts->synchronize($snapshot, $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC')));
    }
}
