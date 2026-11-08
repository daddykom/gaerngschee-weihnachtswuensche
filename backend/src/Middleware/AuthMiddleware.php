<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Auth\Services\JwtService;
use App\Auth\Services\SessionService;
use App\Users\Data\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

final class AuthMiddleware
{
    public function __construct(private readonly ?UserRepository $users = null)
    {
    }

    public function __invoke(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
    ): ResponseInterface {
        $sessionService = new SessionService();
        $userId = $sessionService->getUserId();

        if ($userId !== null) {
            $sessionService->touchActivity();
        } elseif (!$sessionService->hasUserSession()) {
            $jwtService = new JwtService();
            $token = $jwtService->getBearerToken($request);
            $payload = $token === null ? null : $jwtService->verifyToken($token);
            $userId = is_array($payload) && is_string($payload['sub'] ?? null)
                ? $payload['sub']
                : null;
            if ($userId !== null) {
                $tokenVersion = ($this->users ?? new UserRepository())->getTokenVersion($userId);
                if ($tokenVersion === null || $tokenVersion !== ($payload['token_version'] ?? null)) {
                    $userId = null;
                }
            }
        }

        if ($userId === null) {
            return $this->jsonError('SESSION_EXPIRED', 401);
        }

        return $handler->handle($request->withAttribute('user_id', $userId));
    }

    private function jsonError(string $code, int $status): ResponseInterface
    {
        $response = new Response();
        $response->getBody()->write(json_encode([
            'error' => [
                'code' => $code,
                'details' => [],
            ],
        ], JSON_THROW_ON_ERROR));

        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
