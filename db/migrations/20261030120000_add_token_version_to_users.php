<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddTokenVersionToUsers extends AbstractMigration
{
    public function change(): void
    {
        $this->table('users')
            ->addColumn('token_version', 'integer', ['default' => 0])
            ->update();
    }
}
