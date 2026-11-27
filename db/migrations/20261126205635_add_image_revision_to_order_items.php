<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddImageRevisionToOrderItems extends AbstractMigration
{
    public function change(): void
    {
        $this->table('order_items')
            ->addColumn('image_revision', 'integer', ['signed' => false, 'default' => 0])
            ->update();
    }
}
