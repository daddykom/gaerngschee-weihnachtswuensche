<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddWishFields extends AbstractMigration
{
    public function change(): void
    {
        $this->table('order_items')
            ->addColumn('original_title', 'string', ['limit' => 255, 'default' => '', 'after' => 'category'])
            ->addColumn('current_title', 'string', ['limit' => 255, 'default' => '', 'after' => 'original_title'])
            ->addColumn('gift_link', 'string', ['limit' => 2048, 'null' => true, 'after' => 'current_description'])
            ->addColumn('personal_message', 'text', ['null' => true, 'after' => 'current_reason'])
            ->update();

        $this->execute('UPDATE order_items SET original_title = original_description, current_title = current_description');
        $this->execute('UPDATE order_items SET personal_message = current_reason WHERE current_reason IS NOT NULL');
    }
}
