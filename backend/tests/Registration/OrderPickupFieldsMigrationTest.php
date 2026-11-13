<?php

declare(strict_types=1);

namespace Tests\Registration;

use PDO;
use PDOException;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261113083756_add_order_pickup_fields.php';

final class OrderPickupFieldsMigrationTest extends TestCase
{
    public function testExistingOrdersRemainUnchangedAndTokenHashesAreUniqueButOptional(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $adapter = new SQLiteAdapter(['adapter' => 'sqlite']);
        $adapter->setConnection($pdo);
        $migration = new \AddOrderPickupFields('development', 20261113083756);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->table('orders', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string')
            ->addColumn('status', 'string')
            ->create();
        $pdo->exec("INSERT INTO orders (id, status) VALUES ('existing', 'definitive'), ('other', 'released')");
        $migration->change();

        self::assertTrue($adapter->hasIndex('orders', ['pickup_token_hash']));
        self::assertSame([
            ['id' => 'existing', 'status' => 'definitive', 'pickup_token_hash' => null, 'pickup_notification_sent_at' => null],
            ['id' => 'other', 'status' => 'released', 'pickup_token_hash' => null, 'pickup_notification_sent_at' => null],
        ], $pdo->query('SELECT * FROM orders ORDER BY id')->fetchAll());
        $hash = hash('sha256', 'test-token');
        $set = $pdo->prepare('UPDATE orders SET pickup_token_hash = ? WHERE id = ?');
        $set->execute([$hash, 'existing']);
        self::assertSame($hash, $pdo->query("SELECT pickup_token_hash FROM orders WHERE id = 'existing'")->fetchColumn());

        $this->expectException(PDOException::class);
        $set->execute([$hash, 'other']);
    }
}
