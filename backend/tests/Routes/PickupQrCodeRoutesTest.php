<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Routes\PublicRoutes;
use App\Shared\Http\RateLimitService;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class PickupQrCodeRoutesTest extends TestCase
{
    public function testPublicImageEndpointIsRateLimitedIndependentlyOfRegistrationRequests(): void
    {
        $limits = new RateLimitService(TestDatabase::create());
        for ($i = 0; $i < 60; $i++) {
            $limits->consume('pickup-qr|ip:127.0.0.1', 60, 60);
        }
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        PublicRoutes::register($app, rateLimitService: $limits);
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/public/pickup-qr-code/' . str_repeat('a', 64), ['REMOTE_ADDR' => '127.0.0.1']);
        $response = $app->handle($request);
        self::assertSame(429, $response->getStatusCode());
        self::assertNotSame('', $response->getHeaderLine('Retry-After'));
        self::assertNull($limits->consume('ip:127.0.0.1', 10, 60));
    }
}
