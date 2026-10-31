<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class ReplaceOrderStatuses extends AbstractMigration
{
    public function up(): void
    {
        $this->table('orders')
            ->changeColumn('status', 'enum', [
                'values' => [
                    'provisional',
                    'definitive',
                    'draft',
                    'waiting_for_fairgate',
                    'released',
                    'family_size_exceeded',
                    'in_review',
                    'changes_requested',
                    'ready_for_pickup',
                    'completed',
                ],
            ])
            ->update();
        $this->execute("UPDATE orders SET status = 'waiting_for_fairgate' WHERE status = 'provisional'");
        $this->table('orders')
            ->changeColumn('status', 'enum', [
                'values' => [
                    'draft',
                    'waiting_for_fairgate',
                    'released',
                    'family_size_exceeded',
                    'in_review',
                    'changes_requested',
                    'definitive',
                    'ready_for_pickup',
                    'completed',
                ],
            ])
            ->update();
    }

    public function down(): void
    {
        $this->table('orders')
            ->changeColumn('status', 'enum', [
                'provisional',
                'definitive',
                'draft',
                'waiting_for_fairgate',
                'released',
                'family_size_exceeded',
                'in_review',
                'changes_requested',
                'ready_for_pickup',
                'completed',
            ])
            ->update();
        $this->execute("UPDATE orders SET status = 'provisional' WHERE status = 'waiting_for_fairgate'");
        $this->execute("UPDATE orders SET status = 'definitive' WHERE status IN ('draft', 'released', 'family_size_exceeded', 'in_review', 'changes_requested', 'ready_for_pickup', 'completed')");
        $this->table('orders')
            ->changeColumn('status', 'enum', ['values' => ['provisional', 'definitive']])
            ->update();
    }
}
