<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Application;
use App\Registration\Data\OrderRepository;
use App\Routes\AdminRoutes;
use App\Shared\Http\RateLimitService;
use App\Users\Data\UserRepository;
use App\Auth\Services\SessionService;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;
use Tests\Support\TestDatabase;

final class AdminOrderRoutesTest extends TestCase
{
    private \PDO $pdo;
    private UserRepository $users;

    protected function setUp(): void
    {
        (new SessionService())->clear();
        $this->pdo = TestDatabase::create();
        $this->users = new UserRepository($this->pdo);
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    public function testOrderListRequiresAuthentication(): void
    {
        $response = Application::create(new RateLimitService($this->pdo))->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/orders'),
        );

        self::assertSame(401, $response->getStatusCode());
    }

    public function testNonAdminCannotListOrUpdateOrders(): void
    {
        $user = $this->users->createUser('user-order-route@example.com', 'secret', 'user');
        (new SessionService())->setUser($user['id'], 'user');
        $app = $this->createApp();

        self::assertSame(404, $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/admin/orders'))->getStatusCode());
        self::assertSame(404, $app->handle($this->request('PATCH', '/admin/orders/order-1', []))->getStatusCode());
    }

    public function testAdminCanListOrdersWithServerSideFilters(): void
    {
        $admin = $this->users->createUser('admin-order-route@example.com', 'secret', 'admin');
        $client = $this->users->createUser('client-order-route@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($this->pdo);
        $orders->saveForYear($client['id'], 2026, 'released', 1, 1, [[
            'category' => 'gift', 'description' => 'Spiel', 'reason' => 'Wunsch',
        ]]);
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/orders?status%5B%5D=released&category%5B%5D=gift'),
        );
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertCount(1, $data['orders']);
        self::assertSame(['released'], $data['statuses']);
        self::assertSame(['gift'], $data['categories']);
    }

    public function testAdminCanUpdateAnOrderThroughTheRegisteredRoute(): void
    {
        $admin = $this->users->createUser('admin-order-update@example.com', 'secret', 'admin');
        $client = $this->users->createUser('client-order-update@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($this->pdo);
        $order = $orders->saveForYear($client['id'], 2026, 'released', 1, 1, [[
            'category' => 'gift', 'description' => 'Spiel', 'reason' => 'Wunsch',
        ]]);
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle($this->request('PATCH', '/admin/orders/' . $order['id'], [
            'order' => [
                'id' => $order['id'],
                'status' => 'changes_requested',
                'currentText' => $order['currentText'],
                'adminNotes' => 'Bitte anpassen',
                'adultsCount' => 1,
                'childrenCount' => 1,
            ],
            'items' => [[
                'id' => $order['items'][0]['id'],
                'currentDescription' => 'Spiel',
                'currentReason' => 'Wunsch',
                'publicationStatus' => 'submitted',
                'adminNotes' => null,
            ]],
            'action' => 'rejectOrder',
        ]));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('changes_requested', json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR)['order']['status']);
    }

    private function createApp(): \Slim\App
    {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AdminRoutes::register($app, $this->users, null, null, new OrderRepository($this->pdo));
        return $app;
    }

    /** @param array<string, mixed> $body */
    private function request(string $method, string $path, array $body): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode($body, JSON_THROW_ON_ERROR));
        rewind($stream);
        return (new ServerRequestFactory())
            ->createServerRequest($method, $path)
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new Stream($stream));
    }
}
