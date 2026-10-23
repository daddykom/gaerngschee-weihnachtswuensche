<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Users\Data\UserRepository;
use App\Application;
use App\Routes\AuthRoutes;
use App\Auth\Services\JwtService;
use App\Auth\Services\PasswordResetTokenService;
use App\Auth\Services\SessionService;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Registration\Services\RegistrationTokenService;
use App\Fairgate\Services\FairgateContactProvider;
use App\Shared\Http\RateLimitService;
use PDO;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;
use Slim\Factory\AppFactory;
use Tests\Support\TestDatabase;

final class AuthRoutesTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $repository;

    protected function setUp(): void
    {
        putenv('JWT_SECRET=01234567890123456789012345678901');
        putenv('JWT_ALGORITHM=HS256');
        (new SessionService())->clear();

        $this->pdo = TestDatabase::create();
        $this->repository = new UserRepository($this->pdo);
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
        putenv('JWT_SECRET');
        putenv('JWT_ALGORITHM');
    }

    public function testInvalidLoginReturnsUnauthorized(): void
    {
        $request = (new ServerRequestFactory())
            ->createServerRequest('POST', '/auth/login')
            ->withBody((new \Slim\Psr7\Stream(fopen('php://temp', 'r+'))));

        $response = Application::create(new RateLimitService($this->pdo))->handle($request);

        self::assertSame(401, $response->getStatusCode());
        self::assertSame(
            '{"error":{"code":"INVALID_CREDENTIALS","details":[]}}',
            (string) $response->getBody(),
        );
    }

    public function testAllowedUserCanLoginWithSession(): void
    {
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        $app = $this->createAuthApp();

        $response = $app->handle($this->request('/auth/login', [
            'email' => 'user@example.com',
            'password' => 'secret',
        ]));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame($user['id'], $data['user']['id']);
        self::assertSame('user', $data['group']);
        self::assertSame($user['id'], (new SessionService())->getUserId());
        self::assertSame('user', (new SessionService())->getGroup());
        self::assertFalse($data['requiredPasswordReset']);
    }

    public function testFlaggedUserCanLoginButMustChangePassword(): void
    {
        $user = $this->repository->createUser('user@example.com', 'temporary-secret', 'user', true);

        $response = $this->createAuthApp()->handle($this->request('/auth/login', [
            'email' => $user['email'],
            'password' => 'temporary-secret',
        ]));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertTrue($data['requiredPasswordReset']);
        self::assertSame($user['id'], (new SessionService())->getUserId());
    }

    public function testClientCannotLoginEvenWithCorrectPassword(): void
    {
        $this->repository->createUser('client@example.com', 'secret', 'client');

        $response = $this->createAuthApp()->handle($this->request('/auth/login', [
            'email' => 'client@example.com',
            'password' => 'secret',
        ]));

        self::assertSame(401, $response->getStatusCode());
        self::assertSame(
            '{"error":{"code":"INVALID_CREDENTIALS","details":[]}}',
            (string) $response->getBody(),
        );
        self::assertNull((new SessionService())->getUserId());
    }

    public function testWrongPasswordCannotLogin(): void
    {
        $this->repository->createUser('user@example.com', 'secret', 'user');

        $response = $this->createAuthApp()->handle($this->request('/auth/login', [
            'email' => 'user@example.com',
            'password' => 'wrong',
        ]));

        self::assertSame(401, $response->getStatusCode());
        self::assertSame(
            '{"error":{"code":"INVALID_CREDENTIALS","details":[]}}',
            (string) $response->getBody(),
        );
    }

    public function testLogoutClearsSession(): void
    {
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        (new SessionService())->setUser($user['id'], 'user');

        $response = $this->createAuthApp()->handle(
            (new ServerRequestFactory())->createServerRequest('POST', '/auth/logout'),
        );

        self::assertSame(204, $response->getStatusCode());
        self::assertNull((new SessionService())->getUserId());
    }

    public function testAuthenticatedPasswordChangeClearsResetRequirement(): void
    {
        $user = $this->repository->createUser('user@example.com', 'temporary-secret', 'user', true);
        (new SessionService())->setUser($user['id'], 'user');

        $response = $this->createAuthApp()->handle($this->request('/auth/password-change-authenticated', [
            'password' => 'long-enough-secret',
        ]));

        self::assertSame(200, $response->getStatusCode());
        self::assertNotNull($this->repository->verifyPassword('user@example.com', 'long-enough-secret'));
        self::assertFalse((bool) $this->repository->findById($user['id'])['required_password_reset']);
    }

    public function testAuthenticatedPasswordChangeRequiresAuthentication(): void
    {
        $response = $this->createAuthApp()->handle($this->request('/auth/password-change-authenticated', [
            'password' => 'long-enough-secret',
        ]));

        self::assertSame(401, $response->getStatusCode());
    }

    public function testSessionStatusReturnsRemainingIdleTime(): void
    {
        putenv('SESSION_IDLE_TIMEOUT=60');
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        (new SessionService())->setUser($user['id'], 'user');

        $response = $this->createAuthApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/auth/session-status'),
        );
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertGreaterThan(0, $data['secondsRemaining']);
        self::assertLessThanOrEqual(60, $data['secondsRemaining']);
        putenv('SESSION_IDLE_TIMEOUT');
    }

    public function testExpiredSessionStatusReturnsUnauthorizedAndClearsSession(): void
    {
        putenv('SESSION_IDLE_TIMEOUT=60');
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        $session = new SessionService();
        $session->setUser($user['id'], 'user');
        $_SESSION['last_activity'] = time() - 61;

        $response = $this->createAuthApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/auth/session-status'),
        );

        self::assertSame(401, $response->getStatusCode());
        self::assertSame('SESSION_EXPIRED', json_decode((string) $response->getBody(), true)['error']['code']);
        self::assertNull($session->getUserId());
        putenv('SESSION_IDLE_TIMEOUT');
    }

    public function testSessionRefreshExtendsAnActiveSession(): void
    {
        putenv('SESSION_IDLE_TIMEOUT=60');
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        $session = new SessionService();
        $session->setUser($user['id'], 'user');
        $_SESSION['last_activity'] = time() - 30;

        $response = $this->createAuthApp()->handle(
            (new ServerRequestFactory())->createServerRequest('POST', '/auth/session-refresh'),
        );
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertGreaterThan(50, $data['secondsRemaining']);
        putenv('SESSION_IDLE_TIMEOUT');
    }

    public function testRegistrationTokenCreatesClientAndReturnsFairgateSummary(): void
    {
        $email = 'person@example.com';
        $registrationTokens = new RegistrationTokenService($this->pdo);
        $issued = $registrationTokens->issue($email);
        $loginService = new ClientRegistrationLoginService(
            $registrationTokens,
            $this->repository,
            new class () implements FairgateContactProvider {
                public function hasContactByEmail(string $email): bool
                {
                    return true;
                }
                public function findContactDataByEmail(string $email, ?string $membership = null): array
                {
                    return [
                        'success' => true,
                        'data' => [
                            'gender' => 'Female',
                            'salutation' => 'Informal',
                            'correspondence_lang' => 'de',
                            'wohnt_im_gleichen_haushalt' => 'Ja',
                            'name_und_vorname_kind1' => 'Child',
                            'geburtsdatum_kind1' => '2010-01-01',
                        ],
                    ];
                }
            },
        );

        $response = $this->createAuthApp($loginService)->handle($this->request('/auth/registration-login', [
            'token' => $issued['token'],
        ]));
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('client', $data['group']);
        self::assertTrue($data['fairgateUserExists']);
        self::assertSame(1, $data['childrenCount']);
        self::assertSame(2, $data['adultsCount']);
        self::assertSame('Hallo', $data['salutation']);
    }

    private function createAuthApp(?ClientRegistrationLoginService $registrationLoginService = null): \Slim\App
    {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AuthRoutes::register(
            $app,
            $this->repository,
            new JwtService(),
            new SessionService(),
            $registrationLoginService,
        );

        return $app;
    }

    private function request(string $path, array $body): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode($body, JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new ServerRequestFactory())
            ->createServerRequest('POST', $path)
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new Stream($stream));
    }
}
