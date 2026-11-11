<?php

declare(strict_types=1);

namespace Tests\Registration;

use PDO;
use Phinx\Db\Adapter\SQLiteAdapter;
use Phinx\Migration\IrreversibleMigrationException;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261108150000_create_fairgate_registration_requests_table.php';
require_once __DIR__ . '/../../../db/migrations/20261111124710_remove_obsolete_fairgate_statuses.php';

final class ObsoleteFairgateStatusesMigrationTest extends TestCase
{
    public function testConvertsHistoricalOrdersAndRemovesRegistrationStatusWithoutLosingRequests(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $adapter = new SQLiteAdapter(['adapter' => 'sqlite']);
        $adapter->setConnection($pdo);
        $create = new \CreateFairgateRegistrationRequestsTable('development', 20261108150000);
        $create->setAdapter($adapter);
        $create->setMigratingUp(true);
        $create->change();
        $create->table('orders', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string')
            ->addColumn('status', 'string')
            ->create();
        $order = $pdo->prepare('INSERT INTO orders (id, status) VALUES (?, ?)');
        foreach (['waiting_for_fairgate', 'family_size_exceeded', 'draft', 'in_review', 'definitive'] as $status) {
            $order->execute([$status, $status]);
        }
        $request = $pdo->prepare('INSERT INTO fairgate_registration_requests (id, email, status, requested_at, notification_sent_at) VALUES (?, ?, ?, ?, ?)');
        $request->execute(['open', 'open@example.com', 'waiting_for_fairgate', '2026-11-01 12:00:00', null]);
        $request->execute(['sent', 'sent@example.com', 'notification_sent', '2026-11-01 12:00:00', '2026-11-02 12:00:00']);

        $migration = new \RemoveObsoleteFairgateStatuses('development', 20261111124710);
        $migration->setAdapter($adapter);
        $migration->up();

        self::assertSame(['released', 'released', 'draft', 'in_review', 'definitive'], $pdo->query('SELECT status FROM orders ORDER BY rowid')->fetchAll(PDO::FETCH_COLUMN));
        self::assertFalse($adapter->hasColumn('fairgate_registration_requests', 'status'));
        self::assertTrue($adapter->hasIndex('fairgate_registration_requests', ['notification_sent_at', 'last_checked_at']));
        self::assertSame(2, (int) $pdo->query('SELECT COUNT(*) FROM fairgate_registration_requests')->fetchColumn());
        self::assertNull($pdo->query("SELECT notification_sent_at FROM fairgate_registration_requests WHERE id = 'open'")->fetchColumn());
        self::assertSame('2026-11-02 12:00:00', $pdo->query("SELECT notification_sent_at FROM fairgate_registration_requests WHERE id = 'sent'")->fetchColumn());
    }

    public function testRollbackCannotRestoreObsoleteStatuses(): void
    {
        $migration = new \RemoveObsoleteFairgateStatuses('development', 20261111124710);

        $this->expectException(IrreversibleMigrationException::class);
        $migration->down();
    }
}
