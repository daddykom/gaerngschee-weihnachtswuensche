<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Services\OrderStatus;
use PHPUnit\Framework\TestCase;

final class OrderStatusTest extends TestCase
{
    public function testOnlyCurrentWorkflowStatusesAreAvailable(): void
    {
        self::assertSame([
            'draft', 'released', 'in_review', 'changes_requested',
            'definitive', 'ready_for_pickup', 'completed',
        ], OrderStatus::all());
    }

    public function testClientsCanOnlyEditDraftsAndRequestedChanges(): void
    {
        foreach (OrderStatus::all() as $status) {
            self::assertSame(in_array($status, ['draft', 'changes_requested'], true), OrderStatus::canClientEdit($status));
        }
    }
}
