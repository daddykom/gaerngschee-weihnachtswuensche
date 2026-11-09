<?php

declare(strict_types=1);

namespace Tests\Configuration;

use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261109224321_add_admin_access_to_client_configuration.php';

final class AdminAccessMigrationTest extends TestCase
{
    public function testAddsAdminWithoutChangingOtherPermissionsAndIsIdempotent(): void
    {
        $pdo = TestDatabase::create();
        $groupsById = [
            'client' => ['wunschbesteller'],
            'mixed' => ['user', 'wunschbesteller'],
            'existing' => ['admin', 'wunschbesteller'],
            'unrelated' => ['user'],
        ];
        $statement = $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, description, access_group, update_group, label)
             VALUES (:id, :id, :value, :description, :groups, :updates, :id)',
        );
        foreach ($groupsById as $id => $groups) {
            $statement->execute([
                'id' => $id,
                'value' => '"unchanged"',
                'description' => 'Test configuration',
                'groups' => json_encode($groups, JSON_THROW_ON_ERROR),
                'updates' => '["admin"]',
            ]);
        }

        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AddAdminAccessToClientConfiguration('development', 20261109224321);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $migration->change();

        foreach ($pdo->query('SELECT * FROM frontend_config')->fetchAll() as $row) {
            $expected = $groupsById[$row['id']];
            if (in_array('wunschbesteller', $expected, true) && !in_array('admin', $expected, true)) {
                $expected[] = 'admin';
            }
            self::assertSame($expected, json_decode($row['access_group'], true));
            self::assertSame('["admin"]', $row['update_group']);
            self::assertSame('"unchanged"', $row['value']);
        }
    }
}
