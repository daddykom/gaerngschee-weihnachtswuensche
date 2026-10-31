<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddCampaignOrderNumbers extends AbstractMigration
{
    public function change(): void
    {
        $this->table('orders')->addColumn('order_number', 'integer', ['null' => true])->update();

        $years = $this->fetchAll('SELECT DISTINCT year FROM orders ORDER BY year');
        foreach ($years as $yearRow) {
            $year = (int) $yearRow['year'];
            $orders = $this->fetchAll('SELECT id FROM orders WHERE year = ' . $year . ' ORDER BY created_at, id');
            foreach ($orders as $index => $order) {
                $id = addslashes((string) $order['id']);
                $this->execute("UPDATE orders SET order_number = " . ($index + 1) . " WHERE id = '" . $id . "'");
            }
        }

        $this->table('orders')->addIndex(['year', 'order_number'], ['unique' => true])->update();
        $this->table('order_items')
            ->addColumn('item_number', 'integer', ['null' => true])
            ->addIndex(['order_id', 'item_number'], ['unique' => true])
            ->update();
    }
}
