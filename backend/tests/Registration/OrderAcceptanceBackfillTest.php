<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Data\OrderRepository;
use App\Shared\Mail\EmailQueueRepository;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class OrderAcceptanceBackfillTest extends TestCase
{
    public function testPreviewIncludesOnlyEligibleUnsentAndUnqueuedWishListsForTheSelectedYear(): void
    {
        $pdo = TestDatabase::create();
        $eligible = $this->legacyOrder($pdo, 'eligible');
        $this->legacyOrder($pdo, 'other-year', 2025);
        $this->legacyOrder($pdo, 'released', 2026, 'released');
        $this->legacyOrder($pdo, 'pickup', 2026, 'ready_for_pickup');
        $sent = $this->legacyOrder($pdo, 'sent');
        $pdo->prepare('UPDATE orders SET acceptance_email_sent_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$sent['id']]);
        $pending = $this->legacyOrder($pdo, 'pending');
        (new EmailQueueRepository($pdo))->enqueue('order', $pending['id'], 'order_acceptance', 'pending@example.com', ['subject' => 'Existing', 'html' => 'Original details', 'text' => 'Original details'], 'SMTP failed');
        $rejected = $this->legacyOrder($pdo, 'rejected');
        $pdo->prepare("UPDATE order_items SET publication_status = 'rejected' WHERE order_id = ?")->execute([$rejected['id']]);
        $unnumbered = $this->legacyOrder($pdo, 'unnumbered');
        $pdo->prepare('UPDATE orders SET order_number = NULL WHERE id = ?')->execute([$unnumbered['id']]);
        $empty = $this->legacyOrder($pdo, 'empty');
        $pdo->prepare('DELETE FROM order_items WHERE order_id = ?')->execute([$empty['id']]);
        $before = $pdo->query('SELECT * FROM orders ORDER BY id')->fetchAll();
        $orders = new OrderRepository($pdo);
        self::assertSame([$eligible['id']], array_column($orders->findAcceptanceBackfillCandidates(2026), 'id'));
        self::assertSame($before, $pdo->query('SELECT * FROM orders ORDER BY id')->fetchAll());
        self::assertCount(1, (new EmailQueueRepository($pdo))->pending());
        self::assertFalse($orders->enqueueAcceptanceBackfill($pending['id'], 2026));
        self::assertSame('Original details', (new EmailQueueRepository($pdo))->pending()[0]['html_body']);
    }

    public function testEnqueueIsRepeatableAndDoesNotChangeOrderOrWishData(): void
    {
        $pdo = TestDatabase::create();
        $order = $this->legacyOrder($pdo, 'eligible');
        $orders = new OrderRepository($pdo);
        $before = $orders->findById($order['id']);
        self::assertTrue($orders->enqueueAcceptanceBackfill($order['id'], 2026));
        self::assertFalse($orders->enqueueAcceptanceBackfill($order['id'], 2026));
        self::assertSame($before, $orders->findById($order['id']));
        self::assertSame([], $orders->findAcceptanceBackfillCandidates(2026));
        self::assertCount(1, (new EmailQueueRepository($pdo))->pending());
        $orders->deliverAcceptanceNotification($order['id'], static fn () => ['subject' => 'Accepted', 'html' => 'Details', 'text' => 'Details'], static fn () => null);
        self::assertFalse($orders->enqueueAcceptanceBackfill($order['id'], 2026));
        self::assertSame([], $orders->findAcceptanceBackfillCandidates(2026));
    }

    public function testEnqueueRechecksChangedStatusYearAndApprovalBeforeWriting(): void
    {
        $pdo = TestDatabase::create();
        $order = $this->legacyOrder($pdo, 'eligible');
        $orders = new OrderRepository($pdo);
        self::assertCount(1, $orders->findAcceptanceBackfillCandidates(2026));
        self::assertFalse($orders->enqueueAcceptanceBackfill($order['id'], 2025));
        self::assertFalse($orders->enqueueAcceptanceBackfill('missing', 2026));
        $pdo->prepare("UPDATE orders SET status = 'ready_for_pickup' WHERE id = ?")->execute([$order['id']]);
        self::assertFalse($orders->enqueueAcceptanceBackfill($order['id'], 2026));
        $pdo->prepare("UPDATE orders SET status = 'definitive' WHERE id = ?")->execute([$order['id']]);
        $pdo->prepare("UPDATE order_items SET publication_status = 'submitted' WHERE order_id = ?")->execute([$order['id']]);
        self::assertFalse($orders->enqueueAcceptanceBackfill($order['id'], 2026));
        self::assertSame([], (new EmailQueueRepository($pdo))->pending());
    }

    private function legacyOrder(\PDO $pdo, string $name, int $year = 2026, string $status = 'definitive'): array
    {
        $user = (new UserRepository($pdo))->createUser($name . '@example.com', 'secret', 'wunschbesteller');
        $order = (new OrderRepository($pdo))->saveForYear($user['id'], $year, $status, 1, 0, [['category' => 'gift', 'description' => 'Coat', 'reason' => 'Winter']]);
        $pdo->prepare('UPDATE orders SET order_number = ? WHERE id = ?')->execute([(int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn(), $order['id']]);
        $pdo->prepare("UPDATE order_items SET publication_status = 'approved' WHERE order_id = ?")->execute([$order['id']]);
        return $order;
    }
}
