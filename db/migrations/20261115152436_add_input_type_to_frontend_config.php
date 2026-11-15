<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddInputTypeToFrontendConfig extends AbstractMigration
{
    public function up(): void
    {
        $this->table('frontend_config')
            ->addColumn('input_type', 'string', ['limit' => 16, 'null' => false, 'default' => 'text'])
            ->update();
        $this->getUpdateBuilder()
            ->update('frontend_config')
            ->set('input_type', 'textarea')
            ->where(['variable_name' => 'pickup_location'])
            ->execute();
    }

    public function down(): void
    {
        $this->table('frontend_config')->removeColumn('input_type')->update();
    }
}
