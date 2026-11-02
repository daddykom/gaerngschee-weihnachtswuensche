<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AddFulfillerCapacityConfiguration extends AbstractMigration
{
    public function up(): void
    {
        foreach ([
            [
                'id' => '00000000-0000-4000-8000-000000000027',
                'variable_name' => 'maximum_orders_per_year',
                'value' => '999999',
                'description' => 'Maximale Anzahl Orders pro Aktionsjahr, bevor die öffentliche Wunschliste für Wunscherfüller geschlossen wird.',
                'label' => 'Maximale Orders pro Jahr',
                'sort_order' => 55,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000028',
                'variable_name' => 'maximum_order_items_per_year',
                'value' => '600',
                'description' => 'Maximale Anzahl erfasster Wünsche pro Aktionsjahr, bevor die öffentliche Wunschliste für Wunscherfüller geschlossen wird.',
                'label' => 'Maximale Wünsche pro Jahr',
                'sort_order' => 56,
            ],
        ] as $config) {
            $this->execute(
                'INSERT INTO frontend_config
                    (id, variable_name, sort_order, value, description, access_group, update_group, label, pattern, placeholder)
                 SELECT :id, :variable_name, :sort_order, :value, :description, :access_group, :update_group, :label, :pattern, :placeholder
                 WHERE NOT EXISTS (SELECT 1 FROM frontend_config WHERE variable_name = :variable_name_check)',
                [
                    ...$config,
                    'value' => json_encode($config['value'], JSON_THROW_ON_ERROR),
                    'access_group' => json_encode(['admin', 'wunschbesteller'], JSON_THROW_ON_ERROR),
                    'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                    'pattern' => '[1-9]\\d*',
                    'placeholder' => 'z. B. 600',
                    'variable_name_check' => $config['variable_name'],
                ],
            );
        }
    }

    public function down(): void
    {
        throw new IrreversibleMigrationException('Fulfiller capacity configuration cannot be removed safely.');
    }
}
