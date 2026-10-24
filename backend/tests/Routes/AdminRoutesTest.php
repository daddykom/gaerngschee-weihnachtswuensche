<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Users\Data\UserRepository;
use App\Configuration\Data\FrontendConfigRepository;
use App\Application;
use App\Fairgate\Actions\FairgateTestAction;
use App\Fairgate\Actions\FairgateLookupAction;
use App\Registration\Data\OrderRepository;
use App\Routes\AdminRoutes;
use App\Shared\Mail\EmailSenderInterface;
use App\Shared\Http\RateLimitService;
use Tests\Support\TestDatabase;
use App\Auth\Services\SessionService;
use Tests\Support\RecordingEmailSender;
use PDO;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;

final class AdminRoutesTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $repository;

    protected function setUp(): void
    {
        (new SessionService())->clear();
        $this->pdo = TestDatabase::create();
        $this->repository = new UserRepository($this->pdo);
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    public function testAdminUsersRequiresAuthentication(): void
    {
        $response = Application::create(new RateLimitService($this->pdo))->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/users'),
        );

        self::assertSame(401, $response->getStatusCode());
    }

    public function testAdminCanListUsersWithSession(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $this->repository->createUser('user@example.com', 'secret', 'user');
        $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');
        (new SessionService())->setUser($admin['id'], 'admin');
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AdminRoutes::register($app, $this->repository);

        $response = $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/admin/users'));

        self::assertSame(200, $response->getStatusCode());
        $users = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(2, $users);
        self::assertNotSame('client@example.com', $users[0]['email']);
        self::assertNotSame('client@example.com', $users[1]['email']);
    }

    public function testAdminCannotAccessClientUserDetails(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $client = $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/users/' . $client['id']),
        );

        self::assertSame(404, $response->getStatusCode());
    }

    public function testUserCannotListAdminUsers(): void
    {
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        (new SessionService())->setUser($user['id'], 'user');
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AdminRoutes::register($app, $this->repository);

        $response = $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/admin/users'));

        self::assertSame(404, $response->getStatusCode());
    }

    public function testClientCannotListAdminUsers(): void
    {
        $client = $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');
        (new SessionService())->setUser($client['id'], 'wunschbesteller');
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AdminRoutes::register($app, $this->repository);

        $response = $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/admin/users'));

        self::assertSame(404, $response->getStatusCode());
    }

    public function testAdminCanRunFairgateTest(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        (new SessionService())->setUser($admin['id'], 'admin');
        $statement = $this->pdo->prepare(
            'INSERT INTO frontend_config
                (id, variable_name, value, description, access_group, update_group, label)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([
            'config-1', 'fairgate_test_email', '"isabelle.joss@gaerngschee.ch"',
            'Test', '["admin"]', '["admin"]', 'Fairgate Test E-Mail',
        ]);
        $app = $this->createApp(null, new FairgateTestAction(static fn (string $email): array => [
            'success' => true,
            'data' => ['email' => $email],
        ], new FrontendConfigRepository($this->pdo)));

        $response = $app->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/fairgate/test'),
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('isabelle.joss@gaerngschee.ch', json_decode((string) $response->getBody(), true)['email']);
    }

    public function testSuperuserCanLookUpFairgateContactByEmail(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $this->pdo->prepare('UPDATE users SET superuser = 1 WHERE id = ?')->execute([$admin['id']]);
        (new SessionService())->setUser($admin['id'], 'admin');
        $app = $this->createApp(null, null, null, null, new FairgateLookupAction(static fn (string $email, ?string $membership): array => [
            'success' => true,
            'data' => ['email' => $email, 'membership' => $membership],
        ]));

        $response = $app->handle(
            (new ServerRequestFactory())->createServerRequest(
                'GET',
                '/admin/fairgate-lookup?email=%20Person%40Example.com%20&membership=Aktivmitglied',
            ),
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame([
            'email' => 'person@example.com',
            'fairgate' => [
                'success' => true,
                'data' => ['email' => 'person@example.com', 'membership' => 'Aktivmitglied'],
            ],
        ], json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR));
    }

    public function testAdminWithoutSuperuserCannotLookUpFairgateContact(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        (new SessionService())->setUser($admin['id'], 'admin');
        $lookupCalled = false;
        $app = $this->createApp(null, null, null, null, new FairgateLookupAction(static function (string $email, ?string $membership) use (&$lookupCalled): array {
            $lookupCalled = true;
            return [];
        }));

        $response = $app->handle(
            (new ServerRequestFactory())->createServerRequest(
                'GET',
                '/admin/fairgate-lookup?email=person%40example.com',
            ),
        );

        self::assertSame(404, $response->getStatusCode());
        self::assertFalse($lookupCalled);
    }

    public function testFairgateLookupRejectsInvalidEmail(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $this->pdo->prepare('UPDATE users SET superuser = 1 WHERE id = ?')->execute([$admin['id']]);
        (new SessionService())->setUser($admin['id'], 'admin');
        $lookupCalled = false;
        $app = $this->createApp(null, null, null, null, new FairgateLookupAction(static function (string $email, ?string $membership) use (&$lookupCalled): array {
            $lookupCalled = true;
            return [];
        }));

        $response = $app->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/fairgate-lookup?email=invalid'),
        );

        self::assertSame(400, $response->getStatusCode());
        self::assertFalse($lookupCalled);
    }

    public function testAdminCanCreateUserAndEmailIsSentToNewAddress(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        (new SessionService())->setUser($admin['id'], 'admin');
        $emailSender = new RecordingEmailSender();
        $app = $this->createApp($emailSender);

        $response = $app->handle($this->request('POST', '/admin/users', [
            'email' => ' New@Example.com ',
            'group' => 'user',
        ]));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(201, $response->getStatusCode());
        self::assertSame('new@example.com', $data['user']['email']);
        self::assertTrue((bool) $data['user']['required_password_reset']);
        self::assertSame('new@example.com', $emailSender->createdRecipient);
        self::assertSame('new@example.com', $data['emailSentTo']);
    }

    public function testAdminCannotCreateClientUser(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle($this->request('POST', '/admin/users', [
            'email' => 'client@example.com',
            'group' => 'wunschbesteller',
        ]));

        self::assertSame(422, $response->getStatusCode());
        self::assertNull($this->repository->findByEmail('client@example.com'));
    }

    public function testUserCanUpdateOwnEmailButNotAnotherUser(): void
    {
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        $other = $this->repository->createUser('other@example.com', 'secret', 'user');
        (new SessionService())->setUser($user['id'], 'user');
        $emailSender = new RecordingEmailSender();
        $app = $this->createApp($emailSender);

        $ownResponse = $app->handle($this->request('PATCH', '/admin/users/' . $user['id'], [
            'email' => 'changed@example.com',
        ]));
        $otherResponse = $app->handle($this->request('PATCH', '/admin/users/' . $other['id'], [
            'email' => 'blocked@example.com',
        ]));

        self::assertSame(200, $ownResponse->getStatusCode());
        self::assertSame('changed@example.com', $emailSender->changedRecipient);
        self::assertSame(404, $otherResponse->getStatusCode());
    }

    public function testAdminCanUpdateUserGroupAndPasswordResetFlag(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $user = $this->repository->createUser('user@example.com', 'secret', 'user', true);
        (new SessionService())->setUser($admin['id'], 'admin');
        $app = $this->createApp();

        $response = $app->handle($this->request('PATCH', '/admin/users/' . $user['id'], [
            'email' => $user['email'],
            'group' => 'admin',
            'required_password_reset' => false,
        ]));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('admin', $data['user']['group']);
        self::assertFalse((bool) $data['user']['required_password_reset']);
    }

    public function testAdminCannotUpdateClientUser(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $client = $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle($this->request('PATCH', '/admin/users/' . $client['id'], [
            'email' => 'changed@example.com',
            'group' => 'user',
            'required_password_reset' => false,
        ]));

        self::assertSame(404, $response->getStatusCode());
        self::assertSame('client@example.com', $this->repository->findById($client['id'])['email']);
    }

    public function testAdminCanReadUserDetails(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        (new SessionService())->setUser($admin['id'], 'admin');
        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/users/' . $user['id']),
        );
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame($user['id'], $data['user']['id']);
    }

    public function testAdminCanDeleteUser(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        (new SessionService())->setUser($admin['id'], 'admin');
        $app = $this->createApp();

        $response = $app->handle($this->request('DELETE', '/admin/users/' . $user['id']));

        self::assertSame(200, $response->getStatusCode());
        self::assertNull($this->repository->findById($user['id']));
    }

    public function testAdminCannotDeleteClientUser(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $client = $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle(
            $this->request('DELETE', '/admin/users/' . $client['id']),
        );

        self::assertSame(404, $response->getStatusCode());
        self::assertNotNull($this->repository->findById($client['id']));
    }

    public function testAdminCannotSendPasswordResetToClientUser(): void
    {
        $admin = $this->repository->createUser('admin@example.com', 'secret', 'admin');
        $client = $this->repository->createUser('client@example.com', 'secret', 'wunschbesteller');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle(
            $this->request('POST', '/admin/users/' . $client['id'] . '/password-reset'),
        );

        self::assertSame(404, $response->getStatusCode());
    }

    private function createApp(
        ?EmailSenderInterface $emailSender = null,
        ?FairgateTestAction $fairgateTestAction = null,
        ?OrderRepository $orderRepository = null,
        ?FrontendConfigRepository $configRepository = null,
        ?FairgateLookupAction $fairgateLookupAction = null,
    ): \Slim\App {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AdminRoutes::register($app, $this->repository, $emailSender, $fairgateTestAction, $orderRepository, $configRepository, null, $fairgateLookupAction);

        return $app;
    }

    private function insertCampaignYear(): void
    {
        $this->pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, description, access_group, update_group, label)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
        )->execute([
            'config-campaign-year-' . bin2hex(random_bytes(2)), 'campaign_year', '"' . date('Y') . '"', 'Campaign year', '["admin", "wunschbesteller"]', '["admin"]', 'Campaign year',
        ]);
    }

    private function request(string $method, string $path, array $body = []): \Psr\Http\Message\ServerRequestInterface
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
