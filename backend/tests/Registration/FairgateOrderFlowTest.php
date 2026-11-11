<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Auth\Services\SessionService;
use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Data\FairgateContactRepository;
use App\Fairgate\Services\FairgateClient;
use App\Registration\Actions\ClientRegistrationLoginAction;
use App\Registration\Actions\OrderOverviewAction;
use App\Registration\Actions\SaveOrderAction;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Registration\Services\RegistrationTokenService;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Data\UserRepository;
use DateTimeImmutable;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response as HttpResponse;
use PDO;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../../../db/migrations/20261110134342_create_fairgate_contacts_table.php';

final class FairgateOrderFlowTest extends TestCase
{
    private PDO $pdo;
    private SessionService $session;
    private MockHandler $http;
    private array $history = [];

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        session_id('fairgate-order-flow-test');
        SessionService::configure();
        session_start();
        $_SESSION = [];
        $this->session = new SessionService();
        $this->pdo = TestDatabase::create();
        $this->pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);

        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($this->pdo);
        $migration = new \CreateFairgateContactsTable('development', 20261110134342);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        (new FairgateContactRepository($this->pdo))->upsert('42', 'flow@example.com', new DateTimeImmutable());
        $this->http = new MockHandler();
    }

    protected function tearDown(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            session_destroy();
        }
    }

    public function testSavedOrderNeedsOnlyOneExtendedDataRequestAcrossTheEntireFlow(): void
    {
        self::assertTrue($this->fairgate()->hasContactByEmail('flow@example.com', 'Klient*innen'));
        self::assertSame([], $this->history);
        $this->queueExtendedData();
        self::assertTrue($this->login()['firstAccess']);
        self::assertNull($this->load()['order']);
        self::assertNull($this->load()['order']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn());

        $draft = $this->save('draft');
        self::assertSame('draft', $draft['status']);
        self::assertSame(1, $draft['order']['fairgateAdultsCount']);
        self::assertSame(0, $draft['order']['fairgateChildrenCount']);
        self::assertSame($draft['order']['id'], $this->load()['order']['id']);

        $this->session->clear();
        self::assertFalse($this->login()['firstAccess']);
        self::assertSame($draft['order']['id'], $this->save('draft')['order']['id']);
        self::assertSame('released', $this->save('submit')['status']);
        $this->session->clear();
        self::assertFalse($this->login()['firstAccess']);
        self::assertFalse($this->load()['canEdit']);

        $this->assertOnlyAuthenticationAndExtendedData(1);
    }

    public function testAbandoningAnUnsavedOrderStartsANewExtendedDataLookupOnNextLogin(): void
    {
        $this->queueExtendedData();
        self::assertTrue($this->login()['firstAccess']);
        self::assertNull($this->load()['order']);
        $this->session->clear();
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn());

        $this->queueExtendedData();
        self::assertTrue($this->login()['firstAccess']);
        self::assertNull($this->load()['order']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn());

        $this->assertOnlyAuthenticationAndExtendedData(2);
    }

    private function fairgate(): FairgateClient
    {
        $stack = HandlerStack::create($this->http);
        $stack->push(Middleware::history($this->history));

        return new FairgateClient(
            httpClient: new Client(['handler' => $stack]),
            baseUrl: 'https://fairgate.invalid',
            organizationId: 'org-test',
            accessKey: 'test-key',
            tokenValidator: static fn (string $token): bool => $token === 'Bearer test-token',
            contacts: new FairgateContactRepository($this->pdo),
        );
    }

    private function queueExtendedData(): void
    {
        $this->http->append(
            new HttpResponse(200, [], '{"success":true,"data":{"token":"Bearer test-token"}}'),
            new HttpResponse(200, [], '{"success":true,"data":{"wohnt_im_gleichen_haushalt":"Nein"}}'),
        );
    }

    private function login(): array
    {
        $tokens = new RegistrationTokenService($this->pdo);
        $token = $tokens->issue('flow@example.com');
        $action = new ClientRegistrationLoginAction(new ClientRegistrationLoginService(
            $tokens,
            new UserRepository($this->pdo),
            $this->fairgate(),
            new FrontendConfigRepository($this->pdo),
            new OrderRepository($this->pdo),
        ), $this->session);

        return $this->payload($action($this->request('POST', '/auth/registration-login', ['token' => $token['token']]), new Response()));
    }

    private function load(): array
    {
        $action = new OrderOverviewAction(new OrderRepository($this->pdo), new FrontendConfigRepository($this->pdo), $this->session);

        return $this->payload($action($this->request('GET', '/client/order'), new Response()));
    }

    private function save(string $mode): array
    {
        $emails = $this->createMock(EmailSenderInterface::class);
        $emails->method('renderOrderConfirmation')->willReturn(['subject' => 'Saved', 'html' => '<p>Saved</p>', 'text' => 'Saved']);
        $action = new SaveOrderAction(
            new OrderRepository($this->pdo), new FrontendConfigRepository($this->pdo), $this->session,
            users: new UserRepository($this->pdo), emails: $emails,
        );

        return $this->payload($action($this->request('POST', '/client/order', [
            'mode' => $mode, 'adultsCount' => 1, 'childrenCount' => 0, 'text' => 'My situation',
            'password' => 'long-enough-password', 'passwordConfirmation' => 'long-enough-password',
            'items' => [['category' => 'gift', 'personType' => 'adult', 'personIndex' => 1, 'title' => 'Coat', 'description' => 'A warm coat']],
        ]), new Response()));
    }

    private function request(string $method, string $path, array $body = []): ServerRequestInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $path);
        $userId = $this->session->getUserId();
        if ($userId !== null) {
            $request = $request->withAttribute('user', (new UserRepository($this->pdo))->findById($userId));
        }
        $request->getBody()->write(json_encode($body, JSON_THROW_ON_ERROR));

        return $request;
    }

    private function payload(ResponseInterface $response): array
    {
        $body = (string) $response->getBody();
        self::assertSame(200, $response->getStatusCode(), $body);

        return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    }

    private function assertOnlyAuthenticationAndExtendedData(int $logins): void
    {
        $expected = [];
        for ($login = 0; $login < $logins; $login++) {
            $expected[] = ['POST', '/fsa/v1.1/auth/create/org-test/token'];
            $expected[] = ['GET', '/fsa/v2.0/contact/org-test/data/42'];
        }

        self::assertSame($expected, array_map(
            static fn (array $entry): array => [$entry['request']->getMethod(), $entry['request']->getUri()->getPath()],
            $this->history,
        ));
    }
}
