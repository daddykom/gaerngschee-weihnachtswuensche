<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddFairgateReminderEndDateConfiguration extends AbstractMigration
{
    private const VARIABLE_NAME = 'fairgate_reminder_end_date';

    public function up(): void
    {
        if ($this->fetchRow("SELECT id FROM frontend_config WHERE variable_name = '" . self::VARIABLE_NAME . "'") !== false) {
            return;
        }

        $this->execute(
            'INSERT INTO frontend_config
                (id, variable_name, value, description, access_group, update_group, label, pattern, placeholder, sort_order)
             VALUES (:id, :variable_name, :value, :description, :access_group, :update_group, :label, :pattern, :placeholder, :sort_order)',
            [
                'id' => '00000000-0000-4000-8000-000000000020',
                'variable_name' => self::VARIABLE_NAME,
                'value' => json_encode('', JSON_THROW_ON_ERROR),
                'description' => 'Letzter Tag, an dem Fairgate-Mahnungen versendet werden. Das Datum ist inklusive.',
                'access_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                'label' => 'Enddatum Fairgate-Mahnungen',
                'pattern' => '(?:^$|^\d{4}-\d{2}-\d{2}$)',
                'placeholder' => 'YYYY-MM-DD',
                'sort_order' => 95,
            ],
        );
    }

    public function down(): void
    {
        $this->execute(
            'DELETE FROM frontend_config WHERE variable_name = :variable_name',
            ['variable_name' => self::VARIABLE_NAME],
        );
    }
}
