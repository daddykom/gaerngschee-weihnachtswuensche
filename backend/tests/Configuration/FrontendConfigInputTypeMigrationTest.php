<?php

declare(strict_types=1);

namespace Tests\Configuration;

use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261115152436_add_input_type_to_frontend_config.php';

final class FrontendConfigInputTypeMigrationTest extends TestCase
{
    public function testAddsExplicitTypesWithoutChangingExistingValuesAndDefaultsNewEntriesToText(): void
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        $pdo->exec('CREATE TABLE frontend_config (id TEXT PRIMARY KEY, variable_name TEXT NOT NULL, value TEXT NOT NULL, pattern TEXT NULL, access_group TEXT NOT NULL, update_group TEXT NOT NULL)');
        $insert = $pdo->prepare('INSERT INTO frontend_config VALUES (?, ?, ?, ?, ?, ?)');
        $insert->execute(['date', 'pickup_date', '"Samstag, 14–17 Uhr"', null, '["admin"]', '["admin"]']);
        $insert->execute(['location', 'pickup_location', json_encode("Saal A\nHauptstrasse 1"), null, '["admin"]', '["admin"]']);
        $insert->execute(['list', 'other_setting', '["A","B"]', '[A-Z]+', '["admin","user"]', '[]']);
        $before = $pdo->query('SELECT * FROM frontend_config ORDER BY id')->fetchAll();
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AddInputTypeToFrontendConfig('development', 20261115152436);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->up();

        foreach ($pdo->query('SELECT * FROM frontend_config ORDER BY id')->fetchAll() as $index => $row) {
            self::assertSame($row['variable_name'] === 'pickup_location' ? 'textarea' : 'text', $row['input_type']);
            unset($row['input_type']);
            self::assertSame($before[$index], $row);
        }
        $pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group) VALUES ('new', 'new_setting', '\"value\"', '[\"admin\"]', '[\"admin\"]')");
        self::assertSame('text', $pdo->query("SELECT input_type FROM frontend_config WHERE id = 'new'")->fetchColumn());
        $beforeRollback = $pdo->query('SELECT id, variable_name, value, pattern, access_group, update_group FROM frontend_config ORDER BY id')->fetchAll();
        $migration->down();
        self::assertSame($beforeRollback, $pdo->query('SELECT * FROM frontend_config ORDER BY id')->fetchAll());
    }
}
