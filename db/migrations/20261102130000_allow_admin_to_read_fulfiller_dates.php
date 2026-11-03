<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AllowAdminToReadFulfillerDates extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(
            'UPDATE frontend_config
             SET access_group = :access_group
             WHERE variable_name IN (:start_variable, :end_variable)',
            [
                'access_group' => json_encode(['admin', 'wunschbesteller'], JSON_THROW_ON_ERROR),
                'start_variable' => 'fulfiller_start_date',
                'end_variable' => 'fulfiller_end_date',
            ],
        );
    }

    public function down(): void
    {
        throw new IrreversibleMigrationException('Fulfiller date access cannot be reverted safely.');
    }
}
