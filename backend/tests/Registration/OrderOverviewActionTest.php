<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Auth\Services\SessionService;
use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\OrderOverviewAction;
use App\Registration\Data\OrderRepository;
use App\Users\Data\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\TestDatabase;

final class OrderOverviewActionTest extends TestCase
{
    private PDO $pdo;
    private array $user;
    private OrderRepository $orders;
    private SessionService $session;
    private OrderOverviewAction $action;

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        session_id('order-overview-test');
        SessionService::configure();
        session_start();
        $_SESSION = [];

        $this->pdo = TestDatabase::create();
        $this->pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $this->user = (new UserRepository($this->pdo))->createUser('overview@example.com', 'secret', 'wunschbesteller');
        $this->orders = new OrderRepository($this->pdo);
        $this->session = new SessionService();
        $this->session->setUser($this->user['id'], 'wunschbesteller');
        $this->action = new OrderOverviewAction($this->orders, new FrontendConfigRepository($this->pdo), $this->session);
    }

    protected function tearDown(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            session_destroy();
        }
    }

    public function testNewOrderUsesLoginDataOnEveryLoadWithoutCreatingAnOrder(): void
    {
        $this->session->setFairgateOrderData(2026, 'valid', 2, 0);

        for ($load = 0; $load < 2; $load++) {
            $response = $this->load();
            $data = $this->payload($response);

            self::assertSame(200, $response->getStatusCode());
            self::assertNull($data['order']);
            self::assertSame(2026, $data['year']);
            self::assertSame('valid', $data['fairgateStatus']);
            self::assertTrue($data['fairgateUserExists']);
            self::assertSame(2, $data['adultsCount']);
            self::assertSame(0, $data['childrenCount']);
            self::assertTrue($data['canEdit']);
        }
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn());
    }

    public function testExistingOrderUsesVerifiedDatabaseCountsInsteadOfUserInputOrSession(): void
    {
        $order = $this->orders->saveForYear($this->user['id'], 2026, 'draft', 4, 5, [], 'valid', 'Situation', 1, 0);
        $this->session->setFairgateOrderData(2026, 'valid', 2, 3);

        $data = $this->payload($this->load());

        self::assertSame($order, $data['order']);
        self::assertTrue($data['fairgateUserExists']);
        self::assertSame(1, $data['adultsCount']);
        self::assertSame(0, $data['childrenCount']);
        self::assertTrue($data['canEdit']);
    }

    public function testExistingOrderCanBeLoadedWithoutLoginSnapshot(): void
    {
        $this->orders->saveForYear($this->user['id'], 2026, 'released', 2, 1, [], 'valid', 'Situation', 2, 1);

        $response = $this->load();
        $data = $this->payload($response);

        self::assertSame(200, $response->getStatusCode());
        self::assertTrue($data['fairgateUserExists']);
        self::assertSame(2, $data['adultsCount']);
        self::assertSame(1, $data['childrenCount']);
        self::assertFalse($data['canEdit']);
    }

    public function testWaitingOrderDoesNotUseMoreRecentSessionData(): void
    {
        $this->orders->saveForYear($this->user['id'], 2026, 'waiting_for_fairgate', 2, 1, [], 'not_found');
        $this->session->setFairgateOrderData(2026, 'valid', 2, 1);

        $data = $this->payload($this->load());

        self::assertSame('not_found', $data['fairgateStatus']);
        self::assertFalse($data['fairgateUserExists']);
        self::assertNull($data['adultsCount']);
        self::assertNull($data['childrenCount']);
    }

    public function testInvalidLoginDataDoesNotExposeVerifiedCounts(): void
    {
        $this->session->setFairgateOrderData(2026, 'expired', null, null);

        $data = $this->payload($this->load());

        self::assertSame('expired', $data['fairgateStatus']);
        self::assertFalse($data['fairgateUserExists']);
        self::assertNull($data['adultsCount']);
        self::assertNull($data['childrenCount']);
    }

    public function testIncompleteStoredCountsAreNotTreatedAsVerified(): void
    {
        $this->orders->saveForYear($this->user['id'], 2026, 'draft', 2, 1, [], 'valid', 'Situation', 2, null);

        $data = $this->payload($this->load());

        self::assertFalse($data['fairgateUserExists']);
        self::assertNull($data['adultsCount']);
        self::assertNull($data['childrenCount']);
    }

    public function testNewOrderWithoutLoginDataRequiresAnotherLogin(): void
    {
        $response = $this->load();

        self::assertSame(401, $response->getStatusCode());
        self::assertSame('SESSION_EXPIRED', $this->payload($response)['error']['code']);
    }

    public function testLoginDataFromAnotherCampaignCannotBeUsed(): void
    {
        $this->session->setFairgateOrderData(2025, 'valid', 2, 1);

        self::assertSame(401, $this->load()->getStatusCode());
    }

    public function testMissingUserIsRejected(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/client/order');

        self::assertSame(401, ($this->action)($request, new Response())->getStatusCode());
    }

    private function load(): Response
    {
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/client/order')
            ->withAttribute('user', $this->user);

        return ($this->action)($request, new Response());
    }

    private function payload(Response $response): array
    {
        return json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
    }
}
