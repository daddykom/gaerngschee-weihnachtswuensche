<?php

declare(strict_types=1);

namespace Tests\Configuration;

use App\Configuration\Data\FrontendConfigRepository;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261113222955_allow_free_text_fulfiller_handover_date.php';

final class FulfillerHandoverDateMigrationTest extends TestCase
{
    public function testRemovesOnlyTheHandoverDatePatternAndPreservesExistingValuesAndPermissions(): void
    {
        $pdo = TestDatabase::create();
        $insert = $pdo->prepare('INSERT INTO frontend_config
            (id, variable_name, value, access_group, update_group, label, pattern)
            VALUES (?, ?, ?, ?, ?, ?, ?)');
        foreach (['fulfiller_handover_date', 'fulfiller_start_date', 'fulfiller_end_date'] as $name) {
            $insert->execute([$name, $name, '"2026-12-19"', '["admin","wunschbesteller"]', '["admin"]', $name, '\\d{4}-\\d{2}-\\d{2}']);
        }
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AllowFreeTextFulfillerHandoverDate('development', 20261113222955);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $migration->change();

        foreach ($pdo->query('SELECT * FROM frontend_config')->fetchAll() as $row) {
            self::assertSame('"2026-12-19"', $row['value']);
            self::assertSame('["admin","wunschbesteller"]', $row['access_group']);
            self::assertSame('["admin"]', $row['update_group']);
            if ($row['variable_name'] === 'fulfiller_handover_date') {
                self::assertNull($row['pattern']);
                self::assertStringContainsString('17.–19.', $row['placeholder']);
            } else {
                self::assertSame('\\d{4}-\\d{2}-\\d{2}', $row['pattern']);
            }
        }

        $configs = new FrontendConfigRepository($pdo);
        foreach (['19. Dezember 2026', '17.–19. Dezember 2026'] as $value) {
            self::assertSame($value, $configs->update('fulfiller_handover_date', 'admin', $value)['value']);
        }
    }
}
