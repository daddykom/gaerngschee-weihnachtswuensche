<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddPersonAssignmentToOrderItems extends AbstractMigration
{
    public function change(): void
    {
        $this->table('order_items')
            ->addColumn('person_type', 'enum', [
                'values' => ['adult', 'child'],
                'null' => true,
                'after' => 'category',
            ])
            ->addColumn('person_index', 'integer', [
                'null' => true,
                'after' => 'person_type',
            ])
            ->update();
    }
}
