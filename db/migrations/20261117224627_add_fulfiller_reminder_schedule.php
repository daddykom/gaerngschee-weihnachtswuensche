<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddFulfillerReminderSchedule extends AbstractMigration
{
    public function up(): void
    {
        $this->table('fulfiller_reminder_deliveries', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('recipient', 'string', ['limit' => 254])
            ->addColumn('notification_date', 'date')
            ->addColumn('sent_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addIndex(['recipient', 'notification_date'], ['unique' => true])
            ->create();

        $this->table('frontend_config')->insert([
            'id' => '639c9b3c-e7d6-4f12-b644-60d0519c51cd',
            'variable_name' => 'fulfiller_reminder_dates',
            'value' => json_encode('', JSON_THROW_ON_ERROR),
            'label' => 'Erinnerungsdaten für Erfüller',
            'description' => 'Ein Datum pro Zeile im Format JJJJ-MM-TT. An diesen Tagen werden Erfüller an noch nicht eingelieferte Geschenke erinnert (Schweizer Zeit). Leer deaktiviert den Versand.',
            'access_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'input_type' => 'textarea',
            'pattern' => null,
            'placeholder' => "2026-12-01\n2026-12-10",
            'sort_order' => 65,
        ])->saveData();
    }

    public function down(): void
    {
        $this->getDeleteBuilder()->delete('frontend_config')
            ->where(['variable_name' => 'fulfiller_reminder_dates'])->execute();
        $this->table('fulfiller_reminder_deliveries')->drop()->save();
    }
}
