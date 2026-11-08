<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class ExpandOrderAndUserGroups extends AbstractMigration
{
    /**
     * Change Method.
     *
     * Write your reversible migrations using this method.
     *
     * More information on writing migrations is available here:
     * https://book.cakephp.org/phinx/0/en/migrations.html#the-change-method
     *
     * Remember to call "create()" or "update()" and NOT "save()" when working
     * with the Table class.
     */
    public function change(): void
    {
        $this->table('users')
            ->changeColumn('group', 'enum', [
                'values' => ['admin', 'user', 'client', 'wunschbesteller', 'wunscherfueller'],
                'default' => 'user',
            ])
            ->update();

        $this->execute("UPDATE frontend_config SET access_group = REPLACE(access_group, 'client', 'wunschbesteller'), update_group = REPLACE(update_group, 'client', 'wunschbesteller')");

        $this->execute("UPDATE users SET `group` = 'wunschbesteller' WHERE `group` = 'client'");

        $this->table('users')
            ->changeColumn('group', 'enum', [
                'values' => ['admin', 'user', 'wunschbesteller', 'wunscherfueller'],
                'default' => 'user',
            ])
            ->update();

        $this->table('orders')
            ->addColumn('original_text', 'text', ['null' => true])
            ->addColumn('current_text', 'text', ['null' => true])
            ->update();

        $this->table('order_items', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('order_id', 'string', ['limit' => 36])
            ->addColumn('original_description', 'text')
            ->addColumn('current_description', 'text')
            ->addColumn('original_reason', 'text', ['null' => true])
            ->addColumn('current_reason', 'text', ['null' => true])
            ->addColumn('status', 'enum', [
                'values' => ['draft', 'submitted', 'rejected', 'approved', 'reserved', 'received', 'completed'],
                'default' => 'draft',
            ])
            ->addColumn('fulfiller_email', 'string', ['limit' => 254, 'null' => true])
            ->addColumn('reserved_at', 'timestamp', ['null' => true])
            ->addColumn('due_at', 'timestamp', ['null' => true])
            ->addColumn('received_at', 'timestamp', ['null' => true])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP', 'update' => 'CURRENT_TIMESTAMP'])
            ->addIndex('order_id')
            ->addForeignKey('order_id', 'orders', 'id', [
                'delete' => 'CASCADE',
                'update' => 'CASCADE',
            ])
            ->create();

    }
}
