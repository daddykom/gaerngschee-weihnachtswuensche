<?php

declare(strict_types=1);

namespace Tests\Middleware;

use App\Users\Data\UserRepository;
use App\Middleware\GroupMiddleware;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class GroupMiddlewareTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $repository;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->exec(
            'CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                "group" TEXT NOT NULL,
                required_password_reset INTEGER NOT NULL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )',
        );
        $this->repository = new UserRepository($this->pdo);
    }

    public function testRequestWithoutAuthenticatedUserIsNotFound(): void
    {
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::never())->method('handle');

        $response = (new GroupMiddleware(['admin'], $this->repository))->__invoke(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/users'),
            $handler,
        );

        self::assertSame(404, $response->getStatusCode());
        self::assertSame(
            '{"error":{"code":"NOT_FOUND","details":[]}}',
            (string) $response->getBody(),
        );
    }

    public function testDifferentGroupCannotAccessRoute(): void
    {
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::never())->method('handle');

        $response = (new GroupMiddleware(['admin'], $this->repository))->__invoke(
            (new ServerRequestFactory())
                ->createServerRequest('GET', '/admin/users')
                ->withAttribute('user_id', $user['id']),
            $handler,
        );

        self::assertSame(404, $response->getStatusCode());
    }

    public function testOneOfSeveralAllowedGroupsCanAccessRoute(): void
    {
        $user = $this->repository->createUser('user@example.com', 'secret', 'user');
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::once())
            ->method('handle')
            ->willReturn(new Response());

        $request = (new ServerRequestFactory())
            ->createServerRequest('GET', '/admin/users')
            ->withAttribute('user_id', $user['id']);

        $response = (new GroupMiddleware(['admin', 'user'], $this->repository))->__invoke($request, $handler);

        self::assertSame(200, $response->getStatusCode());
    }

    #[DataProvider('userGroups')]
    public function testAllowedGroupCanAccessRoute(string $group): void
    {
        $user = $this->repository->createUser($group . '@example.com', 'secret', $group);
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::once())
            ->method('handle')
            ->willReturn(new Response());

        $request = (new ServerRequestFactory())
            ->createServerRequest('GET', '/' . $group)
            ->withAttribute('user_id', $user['id']);

        $response = (new GroupMiddleware([$group], $this->repository))->__invoke($request, $handler);

        self::assertSame(200, $response->getStatusCode());
    }

    public static function userGroups(): array
    {
        return [['wunschbesteller'], ['user'], ['admin']];
    }
}
