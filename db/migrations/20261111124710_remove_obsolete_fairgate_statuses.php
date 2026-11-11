<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class RemoveObsoleteFairgateStatuses extends AbstractMigration
{
    public function up(): void
    {
        $this->getQueryBuilder('update')
            ->update('orders')
            ->set('status', 'released')
            ->where(['status IN' => ['waiting_for_fairgate', 'family_size_exceeded']])
            ->execute();

        if ($this->getAdapter()->getAdapterType() === 'mysql') {
            $this->table('orders')->changeColumn('status', 'enum', [
                'values' => ['draft', 'released', 'in_review', 'changes_requested', 'definitive', 'ready_for_pickup', 'completed'],
                'default' => 'draft',
            ])->update();
        }

        $this->table('fairgate_registration_requests')
            ->removeIndex(['status', 'last_checked_at'])
            ->update();
        $this->table('fairgate_registration_requests')
            ->removeColumn('status')
            ->addIndex(['notification_sent_at', 'last_checked_at'])
            ->update();
    }

    public function down(): void
    {
        // The original order statuses cannot be reconstructed after conversion.
        throw new IrreversibleMigrationException('Obsolete Fairgate statuses must not be restored.');
    }
}
