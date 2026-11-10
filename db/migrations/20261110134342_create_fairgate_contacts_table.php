<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateFairgateContactsTable extends AbstractMigration
{
    public function change(): void
    {
        $this->table('fairgate_contacts', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('email', 'string', ['limit' => 255])
            ->addColumn('fairgate_contact_id', 'string', ['limit' => 255])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addIndex('email', ['unique' => true])
            ->addIndex('fairgate_contact_id', ['unique' => true])
            ->create();
    }
}
