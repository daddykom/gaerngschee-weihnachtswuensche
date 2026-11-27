<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Actions\AdminOrderUpdateAction;
use App\Registration\Data\FulfillerReservationRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\FulfillerReservationService;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Mail\EmailSender;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Symfony\Component\Mailer\MailerInterface;
use Tests\Support\TestDatabase;

final class AdminOrderFulfillerRemovalTest extends TestCase
{
    private function fixture(): array
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('requester@example.com', 'secret', 'wunschbesteller');
        $order = (new OrderRepository($pdo))->saveForYear($user['id'], 2026, 'definitive', 1, 0, [
            ['category' => 'gift', 'description' => 'Original description', 'reason' => 'Private message'],
        ]);
        $id = $order['items'][0]['id'];
        $pdo->prepare("UPDATE orders SET order_number = 12 WHERE id = ?")->execute([$order['id']]);
        $pdo->prepare("UPDATE order_items SET publication_status = 'approved', fulfillment_status = 'reserved',
            item_number = 1, fulfiller_email = 'giver@example.com', reserved_at = '2026-11-01 12:00:00',
            current_title = 'Edited <title>', current_description = 'Edited description', due_at = '2026-12-20' WHERE id = ?")->execute([$id]);
        return [$pdo, $order['id'], $id];
    }

    private function expected(\PDO $pdo, string $orderId): array
    {
        $item = (new OrderRepository($pdo))->findById($orderId)['items'][0];
        return array_intersect_key($item, array_flip(['fulfillerEmail', 'fulfillmentStatus', 'reservedAt', 'reservationExpiresAt']));
    }

    private function release(\PDO $pdo, string $orderId, string $itemId, array $expected): Response
    {
        $statement = $pdo->prepare('SELECT order_id FROM order_items WHERE id = ?');
        $statement->execute([$itemId]);
        $order = (new OrderRepository($pdo))->findById((string) $statement->fetchColumn());
        $items = array_map(static fn (array $item): array => $item['id'] !== $itemId ? $item : [
            ...$item, 'currentTitle' => 'Saved <title>', 'currentDescription' => 'Saved description',
            'fulfillerRemoval' => $expected,
        ], $order['items']);
        $body = ['order' => [...$order, 'id' => $orderId, 'currentText' => 'Saved family text'], 'items' => $items, 'action' => 'save'];
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode($body, JSON_THROW_ON_ERROR));
        rewind($stream);
        $request = (new ServerRequestFactory())->createServerRequest('PATCH', '/admin/orders/' . $orderId)
            ->withHeader('Content-Type', 'application/json')->withBody(new \Slim\Psr7\Stream($stream));
        return (new AdminOrderUpdateAction(
            new OrderRepository($pdo),
            new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee'),
        ))($request, new Response(), ['orderId' => $orderId]);
    }

    public function testSavesWishTextRemovalAndNotificationTogether(): void
    {
        [$pdo, $orderId, $itemId] = $this->fixture();
        self::assertSame([], (new FulfillerReservationRepository($pdo))->findPublicOrders());
        $response = $this->release($pdo, $orderId, $itemId, $this->expected($pdo, $orderId));
        self::assertSame(200, $response->getStatusCode());
        $savedOrder = json_decode((string) $response->getBody(), true)['order'];
        $item = $savedOrder['items'][0];
        self::assertSame('Saved family text', $savedOrder['currentText']);
        self::assertSame('available', $item['fulfillmentStatus']);
        foreach (['fulfillerEmail', 'reservedAt', 'reservationExpiresAt', 'dueAt'] as $key) {
            self::assertNull($item[$key]);
        }
        self::assertSame('approved', $item['publicationStatus']);
        self::assertSame('Saved <title>', $item['currentTitle']);
        self::assertCount(1, (new FulfillerReservationRepository($pdo))->findPublicOrders());
        $mail = (new EmailQueueRepository($pdo))->pending();
        self::assertCount(1, $mail);
        self::assertSame('giver@example.com', $mail[0]['recipient']);
        self::assertSame('fulfiller_released', $mail[0]['email_type']);
        self::assertStringContainsString('12-1', $mail[0]['html_body']);
        self::assertStringContainsString('Saved &lt;title&gt;', $mail[0]['html_body']);
        self::assertStringContainsString('Saved description', $mail[0]['text_body']);
        self::assertStringContainsString('kein Geschenk mehr', $mail[0]['text_body']);
        self::assertStringNotContainsString('Private message', $mail[0]['html_body']);
        self::assertStringNotContainsString('app.mail.', $mail[0]['html_body']);
        self::assertGreaterThan(0, (new \App\Shared\Events\EventRepository($pdo))->all()['fulfiller-wish-availability']);
    }

    public function testRejectsReceivedAndCompletedGiftsEvenWithAStaleBrowser(): void
    {
        foreach (['received', 'completed', 'reserved'] as $status) {
            [$pdo, $orderId, $itemId] = $this->fixture();
            $expected = $this->expected($pdo, $orderId);
            $pdo->prepare('UPDATE order_items SET fulfillment_status = ?, received_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$status, $itemId]);
            $response = $this->release($pdo, $orderId, $itemId, $expected);
            self::assertSame(409, $response->getStatusCode());
            self::assertStringContainsString('GIFT_ALREADY_RECEIVED', (string) $response->getBody());
            self::assertSame([], (new EmailQueueRepository($pdo))->pending());
            self::assertSame('Edited <title>', (new OrderRepository($pdo))->findById($orderId)['items'][0]['currentTitle']);
        }
    }

    public function testRejectsChangedAssignmentsAndDuplicateRemovalWithoutSendingTwice(): void
    {
        [$pdo, $orderId, $itemId] = $this->fixture();
        $expected = $this->expected($pdo, $orderId);
        $pdo->prepare("UPDATE order_items SET fulfiller_email = 'new@example.com' WHERE id = ?")->execute([$itemId]);
        self::assertSame(409, $this->release($pdo, $orderId, $itemId, $expected)->getStatusCode());
        self::assertSame([], (new EmailQueueRepository($pdo))->pending());
        $expected = $this->expected($pdo, $orderId);
        self::assertSame(200, $this->release($pdo, $orderId, $itemId, $expected)->getStatusCode());
        self::assertSame(409, $this->release($pdo, $orderId, $itemId, $expected)->getStatusCode());
        self::assertCount(1, (new EmailQueueRepository($pdo))->pending());
    }

    public function testInvalidatesPendingLinksBeforeANewGiverReserves(): void
    {
        [$pdo, $orderId, $itemId] = $this->fixture();
        $pdo->prepare("UPDATE order_items SET fulfillment_status = 'available', fulfiller_email = NULL WHERE id = ?")->execute([$itemId]);
        $reservations = new FulfillerReservationService($pdo);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $first = $reservations->request($itemId, 'old@example.com', $now, $now);
        self::assertSame(200, $this->release($pdo, $orderId, $itemId, $this->expected($pdo, $orderId))->getStatusCode());
        self::assertNotNull($reservations->request($itemId, 'new@example.com', $now, $now));
        self::assertNull($reservations->confirm($first['token'], $now));
        self::assertSame('new@example.com', (new OrderRepository($pdo))->findById($orderId)['items'][0]['fulfillerEmail']);
    }

    public function testQueueFailureRollsBackTheRelease(): void
    {
        [$pdo, $orderId, $itemId] = $this->fixture();
        $pdo->exec("CREATE TRIGGER fail_queue BEFORE INSERT ON email_queue BEGIN SELECT RAISE(ABORT, 'simulated failure'); END");
        self::assertSame(500, $this->release($pdo, $orderId, $itemId, $this->expected($pdo, $orderId))->getStatusCode());
        self::assertSame('reserved', (new OrderRepository($pdo))->findById($orderId)['items'][0]['fulfillmentStatus']);
        self::assertSame('Edited <title>', (new OrderRepository($pdo))->findById($orderId)['items'][0]['currentTitle']);
        self::assertNotSame('Saved family text', (new OrderRepository($pdo))->findById($orderId)['currentText']);
    }

    public function testRejectsInvalidInputAndMismatchedOrder(): void
    {
        [$pdo, $orderId, $itemId] = $this->fixture();
        self::assertSame(422, $this->release($pdo, $orderId, $itemId, [])->getStatusCode());
        self::assertSame(404, $this->release($pdo, 'other-order', $itemId, $this->expected($pdo, $orderId))->getStatusCode());
    }
}
