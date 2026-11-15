<?php

declare(strict_types=1);

namespace Tests\Registration;

use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261115134735_add_order_acceptance_email_sent_at.php';

final class OrderAcceptanceEmailMigrationTest extends TestCase
{
    public function testAddsAnEmptySentMarkerWithoutChangingExistingOrdersOrSendingMail(): void
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->exec('CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT NOT NULL)');
        $pdo->exec("INSERT INTO orders (id, status) VALUES ('existing-order', 'definitive')");
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \AddOrderAcceptanceEmailSentAt('development', 20261115134735);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $order = $pdo->query('SELECT * FROM orders')->fetch(\PDO::FETCH_ASSOC);
        self::assertSame(['id' => 'existing-order', 'status' => 'definitive', 'acceptance_email_sent_at' => null], $order);
    }
}
