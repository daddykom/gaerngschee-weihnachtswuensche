<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateFairgateApiTokensTable extends AbstractMigration
{
    public function change(): void
    {
        $this->table('fairgate_api_tokens', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'uuid')
            ->addColumn('scope', 'string', ['limit' => 64])
            ->addColumn('access_token', 'text', ['null' => true])
            ->addColumn('refresh_token', 'text', ['null' => true])
            ->addColumn('expires_at', 'biginteger', ['null' => true])
            ->addColumn('auth_retry_after', 'biginteger', ['default' => 0])
            ->addColumn('data_retry_after', 'biginteger', ['default' => 0])
            ->addColumn('contacts_retry_after', 'biginteger', ['default' => 0])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addIndex('scope', ['unique' => true])
            ->create();
    }
}
