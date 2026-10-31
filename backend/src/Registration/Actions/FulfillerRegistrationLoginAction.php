<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Auth\Services\SessionService;
use App\Registration\Services\FulfillerRegistrationLoginService;
use App\Registration\Services\RegistrationTokenService;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use App\Users\Data\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class FulfillerRegistrationLoginAction
{
    public function __construct(
        private readonly ?FulfillerRegistrationLoginService $loginService = null,
        private readonly ?SessionService $session = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = JsonRequest::string(JsonRequest::body($request), 'token', 2048);
        if ($token === null) {
            return JsonResponse::error($response, 'INVALID_REGISTRATION_TOKEN', 401);
        }

        try {
            $result = ($this->loginService ?? new FulfillerRegistrationLoginService(
                new RegistrationTokenService(),
                new UserRepository(),
            ))->login($token);
        } catch (Throwable $exception) {
            ExceptionLogger::log('Fulfiller registration login failed', $exception);
            return JsonResponse::error($response, 'REGISTRATION_LOGIN_FAILED', 503);
        }
        if ($result === null) {
            return JsonResponse::error($response, 'INVALID_REGISTRATION_TOKEN', 401);
        }

        $user = $result['user'];
        ($this->session ?? new SessionService())->setUser($user['id'], 'wunscherfueller');

        return JsonResponse::success($response, [
            'user' => $user,
            'group' => 'wunscherfueller',
            'requiredPasswordReset' => false,
            'firstAccess' => false,
        ]);
    }
}
