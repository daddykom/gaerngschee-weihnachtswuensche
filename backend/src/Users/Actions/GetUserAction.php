<?php

declare(strict_types=1);

namespace App\Users\Actions;

use App\Users\Data\UserRepository;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class GetUserAction
{
    public function __construct(private readonly ?UserRepository $users = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args = []): ResponseInterface
    {
        $actor = $request->getAttribute('user');
        $userId = (string) ($args['userId'] ?? (is_array($actor) ? ($actor['id'] ?? '') : ''));
        if (!is_array($actor) || (($actor['group'] ?? null) !== 'admin' && ($actor['id'] ?? null) !== $userId)) {
            return JsonResponse::error($response, 'NOT_FOUND', 404);
        }

        $user = ($this->users ?? new UserRepository())->findById($userId);

        return $user === null || in_array($user['group'], ['wunschbesteller', 'wunscherfueller'], true)
            ? JsonResponse::error($response, 'NOT_FOUND', 404)
            : JsonResponse::success($response, ['user' => $user]);
    }
}
