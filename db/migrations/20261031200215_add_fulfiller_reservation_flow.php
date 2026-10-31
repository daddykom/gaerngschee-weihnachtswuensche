<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddFulfillerReservationFlow extends AbstractMigration
{
    /**
     * Change Method.
     *
     * Write your reversible migrations using this method.
     *
     * More information on writing migrations is available here:
     * https://book.cakephp.org/phinx/0/en/migrations.html#the-change-method
     *
     * Remember to call "create()" or "update()" and NOT "save()" when working
     * with the Table class.
     */
    public function change(): void
    {
        $this->table('order_items')
            ->changeColumn('fulfillment_status', 'enum', [
                'values' => ['available', 'pending_confirmation', 'reserved', 'received', 'completed'],
                'default' => 'available',
            ])
            ->addColumn('reservation_expires_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('reservation_token_id', 'string', ['limit' => 36, 'null' => true])
            ->addIndex('reservation_token_id')
            ->addIndex(['fulfillment_status', 'reservation_expires_at'])
            ->update();

        $this->table('fulfiller_reservation_tokens', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('order_item_id', 'string', ['limit' => 36])
            ->addColumn('email', 'string', ['limit' => 254])
            ->addColumn('token_hash', 'string', ['limit' => 64])
            ->addColumn('expires_at', 'timestamp')
            ->addColumn('used_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('privacy_accepted_at', 'timestamp')
            ->addColumn('privacy_confirmed_at', 'timestamp', ['null' => true, 'default' => null])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['update' => 'CURRENT_TIMESTAMP'])
            ->addIndex('token_hash', ['unique' => true])
            ->addIndex(['order_item_id', 'used_at'])
            ->addIndex('expires_at')
            ->create();

        foreach ([
            [
                'id' => '00000000-0000-4000-8000-000000000022',
                'variable_name' => 'fulfiller_handover_date',
                'value' => '2026-12-19',
                'description' => 'Datum der Abgabe für erfüllte Weihnachtswünsche.',
                'label' => 'Abgabedatum für Erfüller',
                'pattern' => '\\d{4}-\\d{2}-\\d{2}',
                'placeholder' => 'JJJJ-MM-TT',
                'sort_order' => 110,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000023',
                'variable_name' => 'fulfiller_handover_time',
                'value' => '10:00–12:00 Uhr',
                'description' => 'Zeitfenster der Abgabe für erfüllte Weihnachtswünsche.',
                'label' => 'Abgabezeit für Erfüller',
                'pattern' => '.+',
                'placeholder' => 'z. B. 10:00–12:00 Uhr',
                'sort_order' => 120,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000024',
                'variable_name' => 'fulfiller_handover_location',
                'value' => 'Clarastrasse 10, 4058 Basel',
                'description' => 'Ort der Abgabe für erfüllte Weihnachtswünsche.',
                'label' => 'Abgabeort für Erfüller',
                'pattern' => '.+',
                'placeholder' => 'Ort und Adresse',
                'sort_order' => 130,
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
                    'access_group' => json_encode(['wunschbesteller'], JSON_THROW_ON_ERROR),
                    'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                    'variable_name_check' => $config['variable_name'],
                ],
            );
        }
    }
}
