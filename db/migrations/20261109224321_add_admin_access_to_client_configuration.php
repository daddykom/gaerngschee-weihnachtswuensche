<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AddAdminAccessToClientConfiguration extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->isMigratingUp()) {
            // Existing admin permissions cannot be distinguished from added permissions.
            throw new IrreversibleMigrationException('Admin access must not be removed automatically.');
        }

        $rows = $this->getQueryBuilder('select')
            ->select(['id', 'access_group'])
            ->from('frontend_config')
            ->execute()
            ->fetchAll('assoc');

        foreach ($rows as $row) {
            $groups = json_decode($row['access_group'], true, 512, JSON_THROW_ON_ERROR);
            if (!in_array('wunschbesteller', $groups, true) || in_array('admin', $groups, true)) {
                continue;
            }

            $this->getQueryBuilder('update')
                ->update('frontend_config')
                ->set('access_group', json_encode([...$groups, 'admin'], JSON_THROW_ON_ERROR))
                ->where(['id' => $row['id']])
                ->execute();
        }
    }
}
