<?php

declare(strict_types=1);

namespace App\Auth\Actions;

use App\Users\Data\UserRepository;
use App\Auth\Services\SessionService;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class LoginAction
{
    public function __construct(
        private readonly ?UserRepository $users = null,
        private readonly ?SessionService $session = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $data = JsonRequest::body($request);
        $email = JsonRequest::string($data, 'email', 254);
        $password = JsonRequest::string($data, 'password', 128);
        if ($email === null || $password === null) {
            return JsonResponse::error($response, 'INVALID_CREDENTIALS', 401);
        }

        $user = ($this->users ?? new UserRepository())->verifyPassword($email, $password);
        if ($user === null || !in_array($user['group'] ?? null, ['admin', 'user', 'wunschbesteller', 'wunscherfueller'], true)) {
            return JsonResponse::error($response, 'INVALID_CREDENTIALS', 401);
        }

        ($this->session ?? new SessionService())->setUser($user['id'], $user['group']);

        return JsonResponse::success($response, [
            'user' => $user,
            'group' => $user['group'],
            'requiredPasswordReset' => (bool) ($user['required_password_reset'] ?? false),
        ]);
    }
}
