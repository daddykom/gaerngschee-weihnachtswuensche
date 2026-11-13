<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddOrderPickupFields extends AbstractMigration
{
    public function change(): void
    {
        $this->table('orders')
            ->addColumn('pickup_token_hash', 'string', ['limit' => 64, 'null' => true, 'default' => null])
            ->addColumn('pickup_notification_sent_at', 'timestamp', ['null' => true, 'default' => null])
            ->addIndex(['pickup_token_hash'], ['unique' => true])
            ->update();
    }
}
