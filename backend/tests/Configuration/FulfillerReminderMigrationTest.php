<?php

declare(strict_types=1);

namespace Tests\Configuration;

use App\Configuration\Data\FrontendConfigRepository;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261117224627_add_fulfiller_reminder_schedule.php';

final class FulfillerReminderMigrationTest extends TestCase
{
    public function testAddsAdminOnlyTextareaAndUniqueDailyDeliveryLog(): void
    {
        $pdo = TestDatabase::create();
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AddFulfillerReminderSchedule('development', 20261117224627);
        $migration->setAdapter($adapter);
        $migration->up();
        $config = new FrontendConfigRepository($pdo);
        $field = $config->findVisibleForGroup('admin')[0];
        self::assertSame('fulfiller_reminder_dates', $field['variableName']);
        self::assertSame('textarea', $field['inputType']);
        self::assertSame('', $field['value']);
        self::assertTrue($field['canUpdate']);
        self::assertSame([], $config->findVisibleForGroup('user'));
        self::assertSame([], $config->findVisibleForGroup('wunschbesteller'));
        $config->update($field['id'], 'admin', "2026-12-01\n2026-12-10");
        self::assertSame("2026-12-01\n2026-12-10", $config->findValueByVariableName('fulfiller_reminder_dates'));
        $pdo->exec("INSERT INTO fulfiller_reminder_deliveries (id, recipient, notification_date) VALUES ('one', 'test@example.com', '2026-12-01')");
        try {
            $pdo->exec("INSERT INTO fulfiller_reminder_deliveries (id, recipient, notification_date) VALUES ('two', 'test@example.com', '2026-12-01')");
            self::fail('Duplicate recipient/date must not be accepted.');
        } catch (\PDOException $exception) {
            self::assertStringContainsString('UNIQUE', $exception->getMessage());
        }
        $migration->down();
        self::assertNull($config->findValueByVariableName('fulfiller_reminder_dates'));
        self::assertFalse($adapter->hasTable('fulfiller_reminder_deliveries'));
    }
}
