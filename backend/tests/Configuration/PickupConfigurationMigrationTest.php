<?php

declare(strict_types=1);

namespace Tests\Configuration;

use App\Configuration\Data\FrontendConfigRepository;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261115115052_add_pickup_configuration.php';

final class PickupConfigurationMigrationTest extends TestCase
{
    public function testAddsEmptyAdminOnlyFreeTextFieldsAndPreservesConfiguredValuesOnRepeat(): void
    {
        $pdo = TestDatabase::create();
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AddPickupConfiguration('development', 20261115115052);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->up();

        $config = new FrontendConfigRepository($pdo);
        $fields = $config->findVisibleForGroup('admin');
        self::assertSame(['pickup_date', 'pickup_location'], array_column($fields, 'variableName'));
        foreach ($fields as $field) {
            self::assertSame('', $field['value']);
            self::assertNull($field['pattern']);
            self::assertTrue($field['canUpdate']);
            $config->update($field['id'], 'admin', "Saved value\nSecond line");
        }
        $migration->up();
        self::assertCount(2, $config->findVisibleForGroup('admin'));
        foreach ($fields as $field) {
            self::assertSame("Saved value\nSecond line", $config->findValueByVariableName($field['variableName']));
        }
        self::assertSame([], $config->findVisibleForGroup('wunschbesteller'));
        self::assertSame([], $config->findVisibleForGroup('user'));
    }
}
