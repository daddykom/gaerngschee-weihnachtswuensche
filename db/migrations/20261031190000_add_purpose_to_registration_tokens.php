<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddPurposeToRegistrationTokens extends AbstractMigration
{
    public function change(): void
    {
        $this->table('registration_tokens')
            ->addColumn('purpose', 'string', ['limit' => 50, 'default' => 'client-order', 'after' => 'email'])
            ->addColumn('privacy_accepted_at', 'timestamp', ['null' => true, 'default' => null, 'after' => 'purpose'])
            ->addIndex(['email', 'purpose', 'used_at'])
            ->update();
    }
}
