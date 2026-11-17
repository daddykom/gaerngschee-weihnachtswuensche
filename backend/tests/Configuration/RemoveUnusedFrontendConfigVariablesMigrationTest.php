<?php

declare(strict_types=1);

namespace Tests\Configuration;

use Phinx\Db\Adapter\SQLiteAdapter;
use Phinx\Migration\IrreversibleMigrationException;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261117210058_remove_unused_frontend_config_variables.php';

final class RemoveUnusedFrontendConfigVariablesMigrationTest extends TestCase
{
    public function testRemovesOnlyTheFourUnusedKeysAndPreservesDonationAndOtherRowsUnchanged(): void
    {
        $pdo = TestDatabase::create();
        $removedKeys = ['fairgate_document_email', 'fairgate_email_interval_days', 'fairgate_reminder_end_date', 'provisional_order_recent_days'];
        $retainedKeys = ['donation_url', 'campaign_year', 'pickup_location', 'fairgate_document_email_backup'];
        $insert = $pdo->prepare('INSERT INTO frontend_config
            (id, variable_name, sort_order, value, description, access_group, update_group, label, pattern, placeholder, input_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ([...$removedKeys, ...$retainedKeys] as $index => $key) {
            $insert->execute([
                'config-' . $index, $key, $index, json_encode("Saved value\n" . $key), 'Existing description',
                '["admin","wunschbesteller"]', '["admin"]', 'Existing label', '[\\s\\S]*', 'Existing placeholder',
                $key === 'pickup_location' ? 'textarea' : 'text', '2026-11-01 12:00:00', '2026-11-02 12:00:00',
            ]);
        }
        $before = $pdo->query('SELECT * FROM frontend_config ORDER BY variable_name')->fetchAll();
        $expected = array_values(array_filter($before, static fn (array $row): bool => in_array($row['variable_name'], $retainedKeys, true)));
        $migration = $this->migration($pdo);
        $migration->up();
        self::assertSame($expected, $pdo->query('SELECT * FROM frontend_config ORDER BY variable_name')->fetchAll());
        $migration->up();
        self::assertSame($expected, $pdo->query('SELECT * FROM frontend_config ORDER BY variable_name')->fetchAll());
    }

    public function testDoesNotPretendToRestoreDeletedUserValuesDuringRollback(): void
    {
        $this->expectException(IrreversibleMigrationException::class);
        $this->migration(TestDatabase::create())->down();
    }

    private function migration(\PDO $pdo): \RemoveUnusedFrontendConfigVariables
    {
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \RemoveUnusedFrontendConfigVariables('development', 20261117210058);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        return $migration;
    }
}
