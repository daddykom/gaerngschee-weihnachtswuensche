<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddAdministrationFieldsToOrders extends AbstractMigration
{
    public function change(): void
    {
        $this->table('orders')
            ->addColumn('admin_notes', 'text', ['null' => true])
            ->addColumn('fairgate_adults_count', 'integer', ['null' => true])
            ->addColumn('fairgate_children_count', 'integer', ['null' => true])
            ->addColumn('processing_year', 'integer', ['null' => true])
            ->addColumn('released_at', 'timestamp', ['null' => true])
            ->addColumn('definitive_at', 'timestamp', ['null' => true])
            ->update();

        $this->table('order_items')
            ->addColumn('admin_notes', 'text', ['null' => true])
            ->addColumn('publication_status', 'enum', [
                'values' => ['draft', 'submitted', 'rejected', 'approved'],
                'default' => 'draft',
            ])
            ->addColumn('fulfillment_status', 'enum', [
                'values' => ['available', 'reserved', 'received', 'completed'],
                'default' => 'available',
            ])
            ->update();

        $this->execute("UPDATE order_items SET publication_status = status WHERE status IN ('draft', 'submitted', 'rejected', 'approved')");
        $this->execute("UPDATE order_items SET fulfillment_status = status WHERE status IN ('reserved', 'received', 'completed')");
    }
}
