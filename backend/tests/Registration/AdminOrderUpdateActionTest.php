<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Actions\AdminOrderUpdateAction;
use App\Registration\Data\OrderRepository;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;
use Slim\Psr7\Stream;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class AdminOrderUpdateActionTest extends TestCase
{
    public function testRejectsReleaseWhenNotEveryItemIsAccepted(): void
    {
        [$pdo, $order] = $this->orderWithItems('released');
        $action = new AdminOrderUpdateAction(new OrderRepository($pdo));

        $response = ($action)($this->request($order['id'], [
            'order' => $this->orderPayload($order, 'definitive'),
            'items' => [$this->itemPayload($order['items'][0], 'submitted')],
            'action' => 'release',
        ]), new Response(), ['orderId' => $order['id']]);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('ITEMS_NOT_ACCEPTED', $this->errorCode($response));
        self::assertSame('released', (new OrderRepository($pdo))->findById($order['id'])['status']);
    }

    public function testRequiresOrderReasonWhenRejectingWithoutRejectedItem(): void
    {
        [$pdo, $order] = $this->orderWithItems('released');
        $action = new AdminOrderUpdateAction(new OrderRepository($pdo));
        $payload = $this->orderPayload($order, 'changes_requested');
        $payload['adminNotes'] = '';

        $response = ($action)($this->request($order['id'], [
            'order' => $payload,
            'items' => [$this->itemPayload($order['items'][0], 'submitted')],
            'action' => 'rejectOrder',
        ]), new Response(), ['orderId' => $order['id']]);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('ORDER_REJECTION_REASON_REQUIRED', $this->errorCode($response));
    }

    public function testRejectsItemWithoutReason(): void
    {
        [$pdo, $order] = $this->orderWithItems('released');
        $action = new AdminOrderUpdateAction(new OrderRepository($pdo));

        $response = ($action)($this->request($order['id'], [
            'order' => $this->orderPayload($order, 'changes_requested'),
            'items' => [$this->itemPayload($order['items'][0], 'rejected', '')],
            'action' => 'save',
        ]), new Response(), ['orderId' => $order['id']]);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('REJECTION_REASON_REQUIRED', $this->errorCode($response));
    }

    public function testSavesWholeOrderAndPreservesOriginalValues(): void
    {
        [$pdo, $order] = $this->orderWithItems('released');
        $action = new AdminOrderUpdateAction(new OrderRepository($pdo));

        $response = ($action)($this->request($order['id'], [
            'order' => [
                ...$this->orderPayload($order, 'changes_requested'),
                'adminNotes' => 'Bitte Rückmeldung geben',
                'currentText' => 'Aktualisierter Ordertext',
            ],
            'items' => [$this->itemPayload($order['items'][0], 'rejected', 'Nicht erfüllbar')],
            'action' => 'rejectOrder',
        ]), new Response(), ['orderId' => $order['id']]);

        self::assertSame(200, $response->getStatusCode());
        $saved = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR)['order'];
        self::assertSame('changes_requested', $saved['status']);
        self::assertSame('Originaler Ordertext', $saved['originalText']);
        self::assertSame('Originalbeschreibung', $saved['items'][0]['originalDescription']);
        self::assertSame('Aktualisierter Ordertext', $saved['currentText']);
        self::assertSame('Nicht erfüllbar', $saved['items'][0]['adminNotes']);
    }

    public function testRejectsUnknownOrderAndMismatchedPayload(): void
    {
        [$pdo, $order] = $this->orderWithItems('released');
        $action = new AdminOrderUpdateAction(new OrderRepository($pdo));

        $notFound = ($action)($this->request('missing', [
            'order' => ['id' => 'missing'],
            'items' => [],
        ]), new Response(), ['orderId' => 'missing']);
        self::assertSame(404, $notFound->getStatusCode());
        self::assertSame('ORDER_NOT_FOUND', $this->errorCode($notFound));

        $mismatch = ($action)($this->request($order['id'], [
            'order' => ['id' => 'other-order'],
            'items' => [],
        ]), new Response(), ['orderId' => $order['id']]);
        self::assertSame(422, $mismatch->getStatusCode());
        self::assertSame('INVALID_ORDER_DATA', $this->errorCode($mismatch));
    }

    public function testRejectsAnItemThatBelongsToAnotherOrder(): void
    {
        $pdo = TestDatabase::create();
        $users = new UserRepository($pdo);
        $orders = new OrderRepository($pdo);
        $firstUser = $users->createUser('first-order@example.com', 'secret', 'wunschbesteller');
        $secondUser = $users->createUser('second-order@example.com', 'secret', 'wunschbesteller');
        $first = $orders->saveForYear($firstUser['id'], 2026, 'released', 1, 0, [[
            'category' => 'gift', 'description' => 'Erster Wunsch', 'reason' => 'Grund',
        ]]);
        $second = $orders->saveForYear($secondUser['id'], 2026, 'released', 1, 0, [[
            'category' => 'gift', 'description' => 'Zweiter Wunsch', 'reason' => 'Grund',
        ]]);
        $action = new AdminOrderUpdateAction($orders);

        $response = ($action)($this->request($first['id'], [
            'order' => $this->orderPayload($first, 'released'),
            'items' => [$this->itemPayload($second['items'][0], 'submitted')],
            'action' => 'save',
        ]), new Response(), ['orderId' => $first['id']]);

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('INVALID_ORDER_DATA', $this->errorCode($response));
    }

    /** @return array{0: \PDO, 1: array<string, mixed>} */
    private function orderWithItems(string $status): array
    {
        $pdo = TestDatabase::create();
        $user = (new UserRepository($pdo))->createUser('admin-order-action@example.com', 'secret', 'wunschbesteller');
        $order = (new OrderRepository($pdo))->saveForYear(
            $user['id'],
            2026,
            $status,
            1,
            1,
            [['category' => 'gift', 'description' => 'Originalbeschreibung', 'reason' => 'Originalbegründung']],
            null,
            'Originaler Ordertext',
        );

        return [$pdo, $order];
    }

    /** @param array<string, mixed> $order @return array<string, mixed> */
    private function orderPayload(array $order, string $status): array
    {
        return [
            'id' => $order['id'],
            'status' => $status,
            'currentText' => $order['currentText'],
            'adminNotes' => $order['adminNotes'],
            'adultsCount' => $order['adultsCount'],
            'childrenCount' => $order['childrenCount'],
        ];
    }

    /** @param array<string, mixed> $item @return array<string, mixed> */
    private function itemPayload(array $item, string $status, ?string $adminNotes = null): array
    {
        return [
            'id' => $item['id'],
            'currentDescription' => $item['currentDescription'],
            'currentReason' => $item['currentReason'],
            'publicationStatus' => $status,
            'adminNotes' => $adminNotes,
        ];
    }

    /** @param array<string, mixed> $body */
    private function request(string $orderId, array $body): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode($body, JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new ServerRequestFactory())
            ->createServerRequest('PATCH', '/admin/orders/' . $orderId)
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new Stream($stream));
    }

    private function errorCode(Response $response): string
    {
        return (string) (json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR)['error']['code'] ?? '');
    }
}
