<?php

declare(strict_types=1);

namespace App\Registration\Services;

final class OrderStatus
{
    public const DRAFT = 'draft';
    public const WAITING_FOR_FAIRGATE = 'waiting_for_fairgate';
    public const RELEASED = 'released';
    public const FAMILY_SIZE_EXCEEDED = 'family_size_exceeded';
    public const IN_REVIEW = 'in_review';
    public const CHANGES_REQUESTED = 'changes_requested';
    public const DEFINITIVE = 'definitive';
    public const READY_FOR_PICKUP = 'ready_for_pickup';
    public const COMPLETED = 'completed';

    /** @return list<string> */
    public static function all(): array
    {
        return [
            self::DRAFT,
            self::WAITING_FOR_FAIRGATE,
            self::RELEASED,
            self::FAMILY_SIZE_EXCEEDED,
            self::IN_REVIEW,
            self::CHANGES_REQUESTED,
            self::DEFINITIVE,
            self::READY_FOR_PICKUP,
            self::COMPLETED,
        ];
    }

    public static function canClientEdit(string $status): bool
    {
        return in_array($status, [self::DRAFT, self::FAMILY_SIZE_EXCEEDED, self::CHANGES_REQUESTED], true);
    }
}
