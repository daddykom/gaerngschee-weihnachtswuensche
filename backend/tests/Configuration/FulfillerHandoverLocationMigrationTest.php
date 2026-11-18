<?php

declare(strict_types=1);

namespace Tests\Configuration;

use App\Configuration\Data\FrontendConfigRepository;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261118213026_allow_multiline_fulfiller_handover_location.php';

final class FulfillerHandoverLocationMigrationTest extends TestCase
{
    public function testEnablesMultilineAddressesWithoutChangingValuesPermissionsOrOtherSettings(): void
    {
        $pdo = TestDatabase::create();
        $insert = $pdo->prepare('INSERT INTO frontend_config
            (id, variable_name, value, access_group, update_group, label, pattern, input_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        foreach (['fulfiller_handover_location', 'fulfiller_handover_time'] as $name) {
            $insert->execute([$name, $name, '"Existing value"', '["admin","wunschbesteller"]', '["admin"]', $name, '.+', 'text']);
        }
        $before = $pdo->query('SELECT * FROM frontend_config ORDER BY id')->fetchAll();
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AllowMultilineFulfillerHandoverLocation('development', 20261118213026);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $migration->change();

        foreach ($pdo->query('SELECT * FROM frontend_config ORDER BY id')->fetchAll() as $index => $row) {
            if ($row['variable_name'] === 'fulfiller_handover_location') {
                self::assertSame('textarea', $row['input_type']);
                self::assertSame('[\s\S]+', $row['pattern']);
                $row['input_type'] = $before[$index]['input_type'];
                $row['pattern'] = $before[$index]['pattern'];
            }
            self::assertSame($before[$index], $row);
        }

        $configs = new FrontendConfigRepository($pdo);
        $address = "Gemeindesaal\nHauptstrasse 1\n4058 Basel";
        $updated = $configs->update('fulfiller_handover_location', 'admin', $address);
        self::assertSame('textarea', $updated['inputType']);
        self::assertSame($address, $updated['value']);
        self::assertSame($address, $configs->findValueByVariableName('fulfiller_handover_location'));

        $this->expectException(\InvalidArgumentException::class);
        $configs->update('fulfiller_handover_location', 'admin', '');
    }
}
