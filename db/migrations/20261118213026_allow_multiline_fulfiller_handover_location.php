<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AllowMultilineFulfillerHandoverLocation extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->isMigratingUp()) {
            // Restoring single-line validation could invalidate an existing address.
            throw new IrreversibleMigrationException('The handover location must remain a multiline value.');
        }

        $this->getQueryBuilder('update')
            ->update('frontend_config')
            ->set(['input_type' => 'textarea', 'pattern' => '[\s\S]+'])
            ->where(['variable_name' => 'fulfiller_handover_location'])
            ->execute();
    }
}
