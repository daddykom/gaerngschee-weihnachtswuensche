<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Routes\UserRoutes;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Data\UserRepository;
use App\Auth\Services\SessionService;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

final class UserRoutesTest extends TestCase
{
    private UserRepository $users;

    protected function setUp(): void
    {
        (new SessionService())->clear();
        $this->users = new UserRepository(TestDatabase::create());
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    public function testUserCanReadAndUpdateOwnProfile(): void
    {
        $user = $this->users->createUser('user@example.com', 'secret', 'user');
        (new SessionService())->setUser($user['id'], 'user');
        $app = $this->createApp();

        $read = $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/user/profile'));
        $update = $app->handle($this->request('PATCH', '/user/profile', ['email' => 'changed@example.com']));

        self::assertSame(200, $read->getStatusCode());
        self::assertSame(200, $update->getStatusCode());
        self::assertSame('changed@example.com', json_decode((string) $update->getBody(), true, 512, JSON_THROW_ON_ERROR)['user']['email']);
    }

    public function testAdminCanUseUserProfileRoute(): void
    {
        $admin = $this->users->createUser('admin@example.com', 'secret', 'admin');
        (new SessionService())->setUser($admin['id'], 'admin');

        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/user/profile'),
        );

        self::assertSame(200, $response->getStatusCode());
    }

    public function testUnauthenticatedProfileAccessIsRejected(): void
    {
        $response = $this->createApp()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/user/profile'),
        );

        self::assertSame(401, $response->getStatusCode());
    }

    private function createApp(?EmailSenderInterface $emails = null): \Slim\App
    {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        UserRoutes::register($app, $this->users, $emails ?? new RecordingEmailSender());

        return $app;
    }

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
