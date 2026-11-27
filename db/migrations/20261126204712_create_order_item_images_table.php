<?php

declare(strict_types=1);

use Phinx\Db\Adapter\MysqlAdapter;
use Phinx\Migration\AbstractMigration;

final class CreateOrderItemImagesTable extends AbstractMigration
{
    public function change(): void
    {
        $this->table('order_item_images', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('order_item_id', 'string', ['limit' => 36])
            ->addColumn('image_data', 'binary', ['limit' => MysqlAdapter::BLOB_MEDIUM])
            ->addColumn('mime_type', 'string', ['limit' => 32])
            ->addColumn('width', 'integer', ['signed' => false])
            ->addColumn('height', 'integer', ['signed' => false])
            ->addColumn('byte_size', 'integer', ['signed' => false])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', [
                'default' => 'CURRENT_TIMESTAMP',
                'update' => 'CURRENT_TIMESTAMP',
            ])
            ->addIndex('order_item_id', ['unique' => true])
            ->addForeignKey('order_item_id', 'order_items', 'id', [
                'delete' => 'CASCADE',
                'update' => 'CASCADE',
            ])
            ->create();
    }
}
