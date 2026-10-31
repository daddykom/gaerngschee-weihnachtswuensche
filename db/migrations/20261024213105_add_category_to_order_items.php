<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddCategoryToOrderItems extends AbstractMigration
{
    public function change(): void
    {
        $this->table('order_items')
            ->addColumn('category', 'enum', [
                'values' => ['voucher', 'gift'],
                'default' => 'gift',
            ])
            ->update();
    }
}
