<?php

declare(strict_types=1);

namespace Tests;

use App\Application;
use App\Auth\Services\SessionService;
use App\Shared\Http\RateLimitService;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;
use Tests\Support\TestDatabase;

final class ApplicationTest extends TestCase
{
    protected function setUp(): void
    {
        (new SessionService())->clear();
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    public function testApplicationBootstraps(): void
    {
        self::assertNotNull(Application::create());
    }

    public function testCorsPreflightAllowsAuthorizationHeader(): void
    {
        $response = Application::create()->handle(
            (new ServerRequestFactory())->createServerRequest('OPTIONS', '/public'),
        );

        self::assertSame(204, $response->getStatusCode());
        self::assertStringContainsString('Authorization', $response->getHeaderLine('Access-Control-Allow-Headers'));
    }

    public function testApplicationAddsCsrfCookieToSafeRoute(): void
    {
        $response = Application::create()->handle(
            (new ServerRequestFactory())->createServerRequest('GET', '/public/php-test'),
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertStringContainsString('XSRF-TOKEN=', $response->getHeaderLine('Set-Cookie'));
    }

    public function testApplicationRejectsAuthenticatedMutationWithoutCsrfToken(): void
    {
        (new SessionService())->setUser('user-123', 'user');

        $response = Application::create()->handle(
            (new ServerRequestFactory())->createServerRequest('POST', '/auth/logout'),
        );

        self::assertSame(403, $response->getStatusCode());
        self::assertStringContainsString('CSRF_TOKEN_INVALID', (string) $response->getBody());
        self::assertSame('user-123', (new SessionService())->getUserId());
    }

    public function testApplicationAllowsAuthenticatedMutationWithCsrfToken(): void
    {
        $session = new SessionService();
        $session->setUser('user-123', 'user');
        $csrfToken = $session->getCsrfToken();

        $response = Application::create()->handle(
            (new ServerRequestFactory())
                ->createServerRequest('POST', '/auth/logout')
                ->withHeader('X-CSRF-Token', $csrfToken),
        );

        self::assertSame(204, $response->getStatusCode());
        self::assertNull((new SessionService())->getUserId());
    }

    public function testApplicationRejectsAuthenticatedMutationWithWrongCsrfToken(): void
    {
        (new SessionService())->setUser('user-123', 'user');

        $response = Application::create()->handle(
            (new ServerRequestFactory())
                ->createServerRequest('POST', '/auth/logout')
                ->withHeader('X-CSRF-Token', 'wrong-token'),
        );

        self::assertSame(403, $response->getStatusCode());
        self::assertStringContainsString('CSRF_TOKEN_INVALID', (string) $response->getBody());
        self::assertSame('user-123', (new SessionService())->getUserId());
    }

    public function testApplicationAppliesPublicStartRateLimit(): void
    {
        $database = TestDatabase::create();
        $app = Application::create(new RateLimitService($database));

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $response = $app->handle($this->jsonRequest('/public/start', [
                'email' => 'not-an-email',
            ]));

            self::assertSame(422, $response->getStatusCode());
        }

        $response = $app->handle($this->jsonRequest('/public/start', [
            'email' => 'not-an-email',
        ]));

        self::assertSame(429, $response->getStatusCode());
        self::assertSame('RATE_LIMITED', json_decode((string) $response->getBody(), true)['error']['code']);
        self::assertGreaterThan(0, (int) $response->getHeaderLine('Retry-After'));
    }

    public function testRejectsOversizedJsonBodies(): void
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, str_repeat('x', 65537));
        rewind($stream);
        $request = (new ServerRequestFactory())
            ->createServerRequest('POST', '/public/start')
            ->withBody(new Stream($stream));

        $response = Application::create(new RateLimitService(TestDatabase::create()))->handle($request);

        self::assertSame(413, $response->getStatusCode());
        self::assertStringContainsString('PAYLOAD_TOO_LARGE', (string) $response->getBody());
    }

    private function jsonRequest(string $path, array $body): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode($body, JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new ServerRequestFactory())
            ->createServerRequest('POST', $path, ['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new Stream($stream));
    }
}
