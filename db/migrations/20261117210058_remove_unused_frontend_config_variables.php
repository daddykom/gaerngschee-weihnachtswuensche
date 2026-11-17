<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class RemoveUnusedFrontendConfigVariables extends AbstractMigration
{
    public function up(): void
    {
        $this->getDeleteBuilder()
            ->delete('frontend_config')
            ->where(['variable_name IN' => [
                'fairgate_document_email',
                'fairgate_email_interval_days',
                'fairgate_reminder_end_date',
                'provisional_order_recent_days',
            ]])
            ->execute();
    }

    public function down(): void
    {
        throw new IrreversibleMigrationException('Removed configuration values can only be restored from a backup.');
    }
}
