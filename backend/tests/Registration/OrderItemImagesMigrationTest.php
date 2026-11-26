<?php

declare(strict_types=1);

namespace Tests\Registration;

use PDO;
use PDOException;
use Phinx\Db\Adapter\ProxyAdapter;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261126204712_create_order_item_images_table.php';

final class OrderItemImagesMigrationTest extends TestCase
{
    private ?PDO $pdo = null;

    public static function adapters(): array
    {
        $adapters = ['SQLite' => ['sqlite']];
        if (getenv('ORDER_ITEM_IMAGES_MYSQL_TEST') === '1') {
            $adapters['MariaDB integration'] = ['mysql'];
        }

        return $adapters;
    }

    protected function tearDown(): void
    {
        if ($this->pdo?->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    #[DataProvider('adapters')]
    public function testExistingWishesDoNotRequireAnImage(string $driver): void
    {
        $pdo = $this->database($driver);
        $itemId = $this->createItem($pdo);
        $before = $pdo->query("SELECT * FROM order_items WHERE id = '$itemId'")->fetch();

        self::assertSame(0, (int) $pdo->query("SELECT COUNT(*) FROM order_item_images WHERE order_item_id = '$itemId'")->fetchColumn());
        self::assertSame($before, $pdo->query("SELECT * FROM order_items WHERE id = '$itemId'")->fetch());
    }

    #[DataProvider('adapters')]
    public function testStoresFiveMegabytesOfBinaryDataAndMetadataWithoutChangingTheWish(string $driver): void
    {
        $pdo = $this->database($driver);
        $itemId = $this->createItem($pdo);
        $before = $pdo->query("SELECT * FROM order_items WHERE id = '$itemId'")->fetch();
        $bytes = str_repeat("\x00\xff\x80A", 5 * 1024 * 1024 / 4);
        $this->insertImage($pdo, $itemId, $bytes);

        $image = $pdo->query("SELECT * FROM order_item_images WHERE order_item_id = '$itemId'")->fetch();
        self::assertSame($bytes, $image['image_data']);
        self::assertSame('image/jpeg', $image['mime_type']);
        self::assertSame(1200, (int) $image['width']);
        self::assertSame(675, (int) $image['height']);
        self::assertSame(strlen($bytes), (int) $image['byte_size']);
        self::assertNotNull($image['created_at']);
        self::assertNotNull($image['updated_at']);
        self::assertSame($before, $pdo->query("SELECT * FROM order_items WHERE id = '$itemId'")->fetch());

        if ($driver === 'mysql') {
            self::assertSame('mediumblob', $pdo->query(
                "SELECT DATA_TYPE FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_item_images'
                   AND COLUMN_NAME = 'image_data'",
            )->fetchColumn());
        }
    }

    #[DataProvider('adapters')]
    public function testAllowsOnlyOneImagePerWish(string $driver): void
    {
        $pdo = $this->database($driver);
        $itemId = $this->createItem($pdo);
        $this->insertImage($pdo, $itemId, 'first image');

        $this->expectException(PDOException::class);
        $this->insertImage($pdo, $itemId, 'second image');
    }

    #[DataProvider('adapters')]
    public function testRejectsAnImageWithoutAnExistingWish(string $driver): void
    {
        $pdo = $this->database($driver);

        $this->expectException(PDOException::class);
        $this->insertImage($pdo, $this->uuid(), 'orphan image');
    }

    #[DataProvider('adapters')]
    public function testDeletingAWishAlsoDeletesItsImage(string $driver): void
    {
        $pdo = $this->database($driver);
        $itemId = $this->createItem($pdo);
        $this->insertImage($pdo, $itemId, 'image');
        $pdo->prepare('DELETE FROM order_items WHERE id = ?')->execute([$itemId]);

        self::assertSame(0, (int) $pdo->query("SELECT COUNT(*) FROM order_item_images WHERE order_item_id = '$itemId'")->fetchColumn());
    }

    public function testMigrationLeavesExistingWishesUntouchedAndCanBeReversed(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $adapter = new SQLiteAdapter(['adapter' => 'sqlite']);
        $adapter->setConnection($pdo);
        $migration = new \CreateOrderItemImagesTable('test', 20261126204712);
        $migration->setAdapter($adapter);
        $migration->table('order_items', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('current_description', 'text')
            ->create();
        $pdo->prepare('INSERT INTO order_items (id, current_description) VALUES (?, ?)')
            ->execute([$this->uuid(), 'Existing wish']);
        $before = $pdo->query('SELECT * FROM order_items')->fetchAll();

        $migration->setMigratingUp(true);
        $migration->change();
        self::assertTrue($adapter->hasTable('order_item_images'));
        self::assertSame($before, $pdo->query('SELECT * FROM order_items')->fetchAll());

        $proxy = new ProxyAdapter($adapter);
        $migration->setAdapter($proxy);
        $migration->setMigratingUp(false);
        $migration->change();
        // SQLite cannot validate foreign keys on the table that rollback removes.
        $pdo->exec('PRAGMA foreign_keys = OFF');
        $proxy->executeInvertedCommands();
        self::assertFalse($adapter->hasTable('order_item_images'));
        self::assertSame($before, $pdo->query('SELECT * FROM order_items')->fetchAll());
    }

    private function database(string $driver): PDO
    {
        if ($driver === 'mysql') {
            if (getenv('APP_ENV') !== 'test' || getenv('DB_NAME') !== 'gaerngschee_integration') {
                self::fail('MariaDB image tests are restricted to the integration database.');
            }
            $pdo = new PDO(
                sprintf('mysql:host=%s;port=%s;dbname=gaerngschee_integration;charset=utf8mb4', getenv('DB_HOST'), getenv('DB_PORT') ?: '3306'),
                getenv('DB_USER'),
                getenv('DB_PASS'),
                [PDO::ATTR_EMULATE_PREPARES => false],
            );
        } else {
            $pdo = new PDO('sqlite::memory:');
            $pdo->exec('PRAGMA foreign_keys = ON');
            $adapter = new SQLiteAdapter(['adapter' => 'sqlite']);
            $adapter->setConnection($pdo);
            $migration = new \CreateOrderItemImagesTable('test', 20261126204712);
            $migration->setAdapter($adapter);
            $migration->setMigratingUp(true);
            $migration->table('users', ['id' => false, 'primary_key' => 'id'])
                ->addColumn('id', 'string', ['limit' => 36])
                ->addColumn('email', 'string')
                ->addColumn('password', 'string')
                ->addColumn('group', 'string')
                ->create();
            $migration->table('orders', ['id' => false, 'primary_key' => 'id'])
                ->addColumn('id', 'string', ['limit' => 36])
                ->addColumn('user_id', 'string', ['limit' => 36])
                ->addColumn('year', 'integer')
                ->addColumn('status', 'string')
                ->create();
            $migration->table('order_items', ['id' => false, 'primary_key' => 'id'])
                ->addColumn('id', 'string', ['limit' => 36])
                ->addColumn('order_id', 'string', ['limit' => 36])
                ->addColumn('original_description', 'text')
                ->addColumn('current_description', 'text')
                ->addColumn('status', 'string')
                ->create();
            $migration->change();
        }

        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->beginTransaction();
        $this->pdo = $pdo;

        return $pdo;
    }

    private function createItem(PDO $pdo): string
    {
        $userId = $this->uuid();
        $orderId = $this->uuid();
        $itemId = $this->uuid();
        $pdo->prepare('INSERT INTO users (id, email, password, `group`) VALUES (?, ?, ?, ?)')
            ->execute([$userId, "image-schema-$userId@example.invalid", 'unused-test-password', 'wunschbesteller']);
        $pdo->prepare('INSERT INTO orders (id, user_id, year, status) VALUES (?, ?, ?, ?)')
            ->execute([$orderId, $userId, 2026, 'draft']);
        $pdo->prepare('INSERT INTO order_items (id, order_id, original_description, current_description, status) VALUES (?, ?, ?, ?, ?)')
            ->execute([$itemId, $orderId, 'Original wish', 'Current wish', 'draft']);

        return $itemId;
    }

    private function insertImage(PDO $pdo, string $itemId, string $bytes): void
    {
        $statement = $pdo->prepare(
            'INSERT INTO order_item_images (id, order_item_id, image_data, mime_type, width, height, byte_size)
             VALUES (:id, :item, :data, :mime, :width, :height, :size)',
        );
        $statement->bindValue('id', $this->uuid());
        $statement->bindValue('item', $itemId);
        $statement->bindValue('data', $bytes, PDO::PARAM_LOB);
        $statement->bindValue('mime', 'image/jpeg');
        $statement->bindValue('width', 1200, PDO::PARAM_INT);
        $statement->bindValue('height', 675, PDO::PARAM_INT);
        $statement->bindValue('size', strlen($bytes), PDO::PARAM_INT);
        $statement->execute();
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);

        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
}
