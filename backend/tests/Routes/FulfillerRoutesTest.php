<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Auth\Services\SessionService;
use App\Registration\Data\OrderRepository;
use App\Routes\FulfillerRoutes;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class FulfillerRoutesTest extends TestCase
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

    public function testFulfillerCanListDefinitiveOrders(): void
    {
        $fulfiller = $this->users->createUser('fulfiller@example.com', 'secret', 'wunscherfueller');
        (new SessionService())->setUser($fulfiller['id'], 'wunscherfueller');
        $this->insertOrderAndItem();

        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/fulfiller/orders?q=Bau'),
        );

        self::assertSame(200, $response->getStatusCode());
        $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('12-1', $payload['orders'][0]['items'][0]['wishNumber']);
    }

    public function testOtherGroupsCannotUseFulfillerRoutes(): void
    {
        $admin = $this->users->createUser('admin@example.com', 'secret', 'admin');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/fulfiller/orders'),
        );

        self::assertSame(404, $response->getStatusCode());
    }

    public function testFulfillerCanReserveAnAvailableWish(): void
    {
        $fulfiller = $this->users->createUser('fulfiller@example.com', 'secret', 'wunscherfueller');
        (new SessionService())->setUser($fulfiller['id'], 'wunscherfueller');
        $this->insertOrderAndItem();

        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('POST', '/fulfiller/order-items/item-1/reserve'),
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('reserved', $this->pdo->query("SELECT fulfillment_status FROM order_items WHERE id = 'item-1'")->fetchColumn());
    }

    private function createApp(): \Slim\App
    {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        FulfillerRoutes::register($app, $this->users, new OrderRepository($this->pdo));

        return $app;
    }

    private function insertOrderAndItem(): void
    {
        $this->pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number, current_text) VALUES ('order-1', 'client-1', 2026, 'definitive', 12, 'Anonymisierte Familie')");
        $this->pdo->exec("INSERT INTO order_items (id, order_id, item_number, category, original_description, current_description, current_reason, status, publication_status, fulfillment_status) VALUES ('item-1', 'order-1', 1, 'gift', 'Bauklötze', 'Bauklötze', 'Zum Spielen', 'approved', 'approved', 'available')");
    }
}
