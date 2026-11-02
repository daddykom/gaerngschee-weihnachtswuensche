<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AddFulfillerDateConfiguration extends AbstractMigration
{
    public function up(): void
    {
        foreach ([
            [
                'id' => '00000000-0000-4000-8000-000000000025',
                'variable_name' => 'fulfiller_start_date',
                'value' => '2025-01-01',
                'description' => 'Startdatum für die Auswahl und Reservierung von Weihnachtswünschen durch Wunscherfüller.',
                'label' => 'Erfüllerstart',
                'sort_order' => 40,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000026',
                'variable_name' => 'fulfiller_end_date',
                'value' => '2025-12-31',
                'description' => 'Enddatum für die Auswahl und Reservierung von Weihnachtswünschen durch Wunscherfüller.',
                'label' => 'Erfüllerende',
                'sort_order' => 50,
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
                    'pattern' => '\\d{4}-\\d{2}-\\d{2}',
                    'placeholder' => 'JJJJ-MM-TT',
                    'variable_name_check' => $config['variable_name'],
                ],
            );
        }
    }

    public function down(): void
    {
        throw new IrreversibleMigrationException('Fulfiller date configuration cannot be removed safely.');
    }
}
