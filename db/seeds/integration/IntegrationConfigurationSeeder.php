<?php

declare(strict_types=1);

use Phinx\Seed\AbstractSeed;

final class IntegrationConfigurationSeeder extends AbstractSeed
{
    public function run(): void
    {
        $this->updateValue('campaign_year', '2026');
        $this->updateValue('campaign_start_date', '2026-01-01');
        $this->updateValue('campaign_end_date', '2026-12-31');
        $this->updateValue('fulfiller_start_date', '2026-01-01');
        $this->updateValue('fulfiller_end_date', '2026-12-31');
        $this->updateAccess('fairgate_test_email', ['admin'], ['admin']);
    }

    private function updateValue(string $variableName, string $value): void
    {
        $this->query(
            'UPDATE frontend_config SET value = :value WHERE variable_name = :variable_name',
            [
                'value' => json_encode($value, JSON_THROW_ON_ERROR),
                'variable_name' => $variableName,
            ],
        );
    }

    private function updateAccess(string $variableName, array $accessGroup, array $updateGroup): void
    {
        $this->query(
            'UPDATE frontend_config
             SET access_group = :access_group, update_group = :update_group
             WHERE variable_name = :variable_name',
            [
                'access_group' => json_encode($accessGroup, JSON_THROW_ON_ERROR),
                'update_group' => json_encode($updateGroup, JSON_THROW_ON_ERROR),
                'variable_name' => $variableName,
            ],
        );
    }
}
