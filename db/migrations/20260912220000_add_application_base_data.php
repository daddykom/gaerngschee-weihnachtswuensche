<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AddApplicationBaseData extends AbstractMigration
{
    private const ADMIN_EMAIL = 'admin@gaerngschee.ch';
    private const ADMIN_PASSWORD_HASH = '$2y$12$MciZlmhObKryTTCXdF/OOOmrUMfXPkA3XEBK2Ks229E7Kjitu/3.W';

    public function up(): void
    {
        $this->addFrontendConfig();
        $this->addInitialAdmin();
    }

    public function down(): void
    {
        throw new IrreversibleMigrationException('Application base data cannot be removed safely.');
    }

    private function addFrontendConfig(): void
    {
        $configs = [
            [
                'id' => '00000000-0000-4000-8000-000000000015',
                'variable_name' => 'campaign_year',
                'value' => '2025',
                'description' => 'Jahr der aktuellen Weihnachtswünsche-Aktion und Bestellungen.',
                'access_group' => ['admin', 'client'],
                'update_group' => ['admin'],
                'label' => 'Aktionsjahr',
                'pattern' => '\\d{4}',
                'placeholder' => 'z. B. 2026',
                'sort_order' => 10,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000016',
                'variable_name' => 'donation_url',
                'value' => 'https://aktionen.gaerngschee.ch/weihnachtswuensche/spenden',
                'description' => 'Link zur Spenden-Seite der Weihnachtswünsche-Aktion.',
                'access_group' => ['admin', 'client'],
                'update_group' => ['admin'],
                'label' => 'Spenden-Link',
                'pattern' => 'https://[^\\s]+',
                'placeholder' => 'https://...',
                'sort_order' => 60,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000017',
                'variable_name' => 'campaign_start_date',
                'value' => '2025-01-01',
                'description' => 'Startdatum der Weihnachtswünsche-Aktion.',
                'access_group' => ['admin', 'client'],
                'update_group' => ['admin'],
                'label' => 'Aktionsstart',
                'pattern' => '\\d{4}-\\d{2}-\\d{2}',
                'placeholder' => 'JJJJ-MM-TT',
                'sort_order' => 20,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000018',
                'variable_name' => 'campaign_end_date',
                'value' => '2025-12-31',
                'description' => 'Enddatum der Weihnachtswünsche-Aktion.',
                'access_group' => ['admin', 'client'],
                'update_group' => ['admin'],
                'label' => 'Aktionsende',
                'pattern' => '\\d{4}-\\d{2}-\\d{2}',
                'placeholder' => 'JJJJ-MM-TT',
                'sort_order' => 30,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000010',
                'variable_name' => 'fairgate_test_email',
                'value' => 'isabelle.joss@gaerngschee.ch',
                'description' => 'E-Mail-Adresse für den Fairgate-Verbindungstest.',
                'access_group' => ['admin'],
                'update_group' => [],
                'label' => 'Fairgate Test-E-Mail-Adresse',
                'pattern' => '[^@\\s]+@[^@\\s]+\\.[^@\\s]+',
                'placeholder' => 'name@beispiel.ch',
                'sort_order' => 80,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000011',
                'variable_name' => 'fairgate_url',
                'value' => 'https://mein.fairgate.ch/vgbh/register/MTI0MTA=',
                'description' => 'Link zur Registrierung bei Fairgate.',
                'access_group' => ['client'],
                'update_group' => ['admin'],
                'label' => 'Fairgate-Registrierungslink',
                'pattern' => 'https://[^\\s]+',
                'placeholder' => 'https://...',
                'sort_order' => 70,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000012',
                'variable_name' => 'fairgate_email_interval_days',
                'value' => '7',
                'description' => 'Abstand zwischen Erinnerungs-E-Mails in Tagen.',
                'access_group' => ['admin'],
                'update_group' => ['admin'],
                'label' => 'Fairgate-E-Mail-Abstand',
                'pattern' => '[1-9]\\d*',
                'placeholder' => 'z. B. 7',
                'sort_order' => 90,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000013',
                'variable_name' => 'registration_token_retention_days',
                'value' => '365',
                'description' => 'Aufbewahrungsdauer abgelaufener Registrierungstokens in Tagen.',
                'access_group' => [],
                'update_group' => [],
                'label' => 'Registrierungstoken-Aufbewahrung',
                'pattern' => '[1-9]\\d*',
                'placeholder' => 'z. B. 365',
                'sort_order' => 10,
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000014',
                'variable_name' => 'provisional_order_recent_days',
                'value' => '14',
                'description' => 'Zeitraum für aktuelle provisorische Bestellungen in Tagen.',
                'access_group' => ['admin', 'user'],
                'update_group' => ['admin'],
                'label' => 'Zeitraum provisorischer Bestellungen',
                'pattern' => '[1-9]\\d*',
                'placeholder' => 'z. B. 14',
                'sort_order' => 100,
            ],
        ];

        foreach ($configs as $config) {
            if ($this->fetchRow(sprintf(
                "SELECT id FROM frontend_config WHERE variable_name = '%s'",
                $config['variable_name'],
            )) !== false) {
                continue;
            }

            $this->execute(
                'INSERT INTO frontend_config
                    (id, variable_name, value, description, access_group, update_group, label, pattern, placeholder)
                 VALUES (:id, :variable_name, :value, :description, :access_group, :update_group, :label, :pattern, :placeholder)',
                [
                    'id' => $config['id'],
                    'variable_name' => $config['variable_name'],
                    'value' => json_encode($config['value'], JSON_THROW_ON_ERROR),
                    'description' => $config['description'],
                    'access_group' => json_encode($config['access_group'], JSON_THROW_ON_ERROR),
                    'update_group' => json_encode($config['update_group'], JSON_THROW_ON_ERROR),
                    'label' => $config['label'],
                    'pattern' => $config['pattern'],
                    'placeholder' => $config['placeholder'],
                ],
            );
        }
    }

    private function addInitialAdmin(): void
    {
        if ($this->fetchRow(sprintf(
            "SELECT id FROM users WHERE email = '%s'",
            self::ADMIN_EMAIL,
        )) !== false) {
            return;
        }

        $this->execute(
            'INSERT INTO users (id, email, password, `group`, required_password_reset)
             VALUES (:id, :email, :password, :group, :required_password_reset)',
            [
                'id' => '00000000-0000-4000-8000-000000000001',
                'email' => self::ADMIN_EMAIL,
                'password' => self::ADMIN_PASSWORD_HASH,
                'group' => 'admin',
                'required_password_reset' => 0,
            ],
        );
    }
}
