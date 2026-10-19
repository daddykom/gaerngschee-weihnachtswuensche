<?php

declare(strict_types=1);

namespace App;

use App\Routes\AdminRoutes;
use App\Routes\ConfigurationRoutes;
use App\Middleware\CsrfMiddleware;
use App\Routes\AuthRoutes;
use App\Routes\ClientRoutes;
use App\Routes\PublicRoutes;
use App\Auth\Services\SessionService;
use App\Shared\Http\RateLimitService;
use App\Shared\Http\JsonResponse;
use App\Shared\Http\EventResponseHeaders;
use App\Shared\Events\EventRepository;
use App\Shared\Database\Database;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\App;
use Slim\Factory\AppFactory;
use Slim\Psr7\Response;

final class Application
{
    public static function create(?RateLimitService $rateLimitService = null): App
    {
        if (session_status() === PHP_SESSION_NONE) {
            SessionService::configure();
            session_start();
        }

        $app = AppFactory::create();
        $rateLimitService ??= new RateLimitService();

        $app->addRoutingMiddleware();
        $app->add(new CsrfMiddleware());
        $frontendOrigin = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');

        $app->add(function (ServerRequestInterface $request, $handler) use ($frontendOrigin): ResponseInterface {
            $addEventHeaders = static function (ResponseInterface $response): ResponseInterface {
                try {
                    return EventResponseHeaders::add($response, new EventRepository(Database::getConnection()));
                } catch (\Throwable) {
                    return $response;
                }
            };
            if ($request->getMethod() === 'OPTIONS') {
                $response = new Response();
                return $addEventHeaders($response
                    ->withHeader('Access-Control-Allow-Origin', $frontendOrigin)
                    ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
                    ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
                    ->withHeader('Access-Control-Allow-Credentials', 'true')
                    ->withStatus(204));
            }

            try {
                $response = $handler->handle($request);
            } catch (\LengthException) {
                return $addEventHeaders(JsonResponse::error(new Response(), 'PAYLOAD_TOO_LARGE', 413));
            }
            if (!$response->hasHeader('Content-Type')) {
                $response = $response->withHeader('Content-Type', 'application/json');
            }

            return $addEventHeaders($response
                ->withHeader('Access-Control-Allow-Origin', $frontendOrigin)
                ->withHeader('Access-Control-Allow-Credentials', 'true'));
        });

        PublicRoutes::register($app, null, null, null, null, $rateLimitService);
        AuthRoutes::register($app, null, null, null, null, $rateLimitService);
        ClientRoutes::register($app);
        AdminRoutes::register($app, null, null, null, null, null, $rateLimitService);
        ConfigurationRoutes::register($app);

        return $app;
    }
}
