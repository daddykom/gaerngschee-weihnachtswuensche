<?php

declare(strict_types=1);

namespace Tests\Middleware;

use App\Middleware\AuthMiddleware;
use App\Auth\Services\JwtService;
use App\Auth\Services\SessionService;
use App\Users\Data\UserRepository;
use Tests\Support\TestDatabase;
use PHPUnit\Framework\TestCase;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class AuthMiddlewareTest extends TestCase
{
    private \PDO $pdo;
    protected function setUp(): void
    {
        putenv('JWT_SECRET=01234567890123456789012345678901');
        $this->pdo = TestDatabase::create();
        $this->pdo->exec("INSERT INTO users (id, email, password, \"group\") VALUES ('user-123', 'user@example.com', 'hash', 'user')");
        (new SessionService())->clear();
    }

    protected function tearDown(): void
    {
        putenv('JWT_SECRET');
        (new SessionService())->clear();
    }

    public function testUnauthenticatedRequestIsRejected(): void
    {
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::never())->method('handle');

        $response = (new AuthMiddleware())
            ->__invoke(
                (new ServerRequestFactory())->createServerRequest('GET', '/admin/users'),
                $handler,
            );

        self::assertSame(401, $response->getStatusCode());
        self::assertSame(
            '{"error":{"code":"SESSION_EXPIRED","details":[]}}',
            (string) $response->getBody(),
        );
    }

    public function testBearerTokenAddsUserIdToRequest(): void
    {
        $token = (new JwtService())->createToken('user-123', 0);
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::once())
            ->method('handle')
            ->with(self::callback(static fn ($request): bool => $request->getAttribute('user_id') === 'user-123'))
            ->willReturn(new Response());

        $request = (new ServerRequestFactory())
            ->createServerRequest('GET', '/admin/users')
            ->withHeader('Authorization', 'Bearer ' . $token);

        self::assertSame(200, (new AuthMiddleware(new UserRepository($this->pdo)))->__invoke($request, $handler)->getStatusCode());
    }

    public function testSessionAddsUserIdToRequest(): void
    {
        (new SessionService())->setUser('user-123', 'user');
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::once())
            ->method('handle')
            ->with(self::callback(static fn ($request): bool => $request->getAttribute('user_id') === 'user-123'))
            ->willReturn(new Response());

        $response = (new AuthMiddleware())->__invoke(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/users'),
            $handler,
        );

        self::assertSame(200, $response->getStatusCode());
    }

    public function testInvalidBearerTokenIsRejected(): void
    {
        $handler = $this->createMock(RequestHandlerInterface::class);
        $handler->expects(self::never())->method('handle');
        $request = (new ServerRequestFactory())
            ->createServerRequest('GET', '/admin/users')
            ->withHeader('Authorization', 'Bearer invalid-token');

        $response = (new AuthMiddleware())->__invoke($request, $handler);

        self::assertSame(401, $response->getStatusCode());
    }
}
