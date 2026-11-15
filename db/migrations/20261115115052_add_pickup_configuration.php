<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AddPickupConfiguration extends AbstractMigration
{
    public function up(): void
    {
        foreach ([
            ['id' => 'f516b52c-beb1-482d-933e-c59d32c4e282', 'variable_name' => 'pickup_date', 'label' => 'Abholdatum und Zeit', 'description' => 'Freie Terminangabe für die Abholung; wird unverändert in E-Mails übernommen.', 'sort_order' => 70],
            ['id' => '8ad589e2-ac92-48b9-b8ab-17e26ff834e7', 'variable_name' => 'pickup_location', 'label' => 'Abholort', 'description' => 'Ort, Adresse und Hinweise zur Abholung. Mehrere Zeilen sind möglich.', 'sort_order' => 71],
        ] as $config) {
            $existing = $this->fetchRow('SELECT id FROM frontend_config WHERE variable_name = ' . $this->getAdapter()->getConnection()->quote($config['variable_name']));
            if ($existing !== false) {
                continue;
            }
            $this->table('frontend_config')->insert([
                ...$config,
                'value' => json_encode('', JSON_THROW_ON_ERROR),
                'access_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                'pattern' => null,
                'placeholder' => null,
            ])->saveData();
        }
    }

    public function down(): void
    {
        throw new IrreversibleMigrationException('Configured pickup details must not be removed automatically.');
    }
}
