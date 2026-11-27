<?php

declare(strict_types=1);

namespace Tests\Registration;

use PDO;
use Phinx\Db\Adapter\ProxyAdapter;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261126205635_add_image_revision_to_order_items.php';

final class OrderItemImageRevisionMigrationTest extends TestCase
{
    public function testAddsInitialRevisionWithoutChangingWishesAndCanBeReversed(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $adapter = new SQLiteAdapter(['adapter' => 'sqlite']);
        $adapter->setConnection($pdo);
        $migration = new \AddImageRevisionToOrderItems('test', 20261126205635);
        $migration->setAdapter($adapter);
        $migration->table('order_items', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string')
            ->addColumn('current_description', 'text')
            ->create();
        $pdo->exec("INSERT INTO order_items VALUES ('existing-wish', 'Existing description')");
        $before = $pdo->query('SELECT * FROM order_items')->fetchAll();
        $migration->setMigratingUp(true);
        $migration->change();
        self::assertSame(0, (int) $pdo->query('SELECT image_revision FROM order_items')->fetchColumn());
        self::assertSame($before, $pdo->query('SELECT id, current_description FROM order_items')->fetchAll());

        $proxy = new ProxyAdapter($adapter);
        $migration->setAdapter($proxy);
        $migration->setMigratingUp(false);
        $migration->change();
        $proxy->executeInvertedCommands();
        self::assertFalse($adapter->hasColumn('order_items', 'image_revision'));
        self::assertSame($before, $pdo->query('SELECT * FROM order_items')->fetchAll());
    }
}
