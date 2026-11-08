<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateFairgateRegistrationRequestsTable extends AbstractMigration
{
    public function change(): void
    {
        $this->table('fairgate_registration_requests', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('email', 'string', ['limit' => 255])
            ->addColumn('status', 'string', ['limit' => 30, 'default' => 'waiting_for_fairgate'])
            ->addColumn('requested_at', 'timestamp')
            ->addColumn('last_checked_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('fairgate_found_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('notification_sent_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['update' => 'CURRENT_TIMESTAMP'])
            ->addIndex('email', ['unique' => true])
            ->addIndex(['status', 'last_checked_at'])
            ->create();
    }
}
