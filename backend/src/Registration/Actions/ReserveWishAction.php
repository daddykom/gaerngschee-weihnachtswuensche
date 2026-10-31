<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ReserveWishAction
{
    public function __construct(private readonly ?OrderRepository $orders = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $user = $request->getAttribute('user');
        $itemId = is_string($args['itemId'] ?? null) ? $args['itemId'] : '';
        if (!is_array($user) || !is_string($user['email'] ?? null) || $user['email'] === '' || $itemId === '') {
            return JsonResponse::error($response, 'INVALID_WISH_DATA', 422);
        }

        $repository = $this->orders ?? new OrderRepository(Database::getConnection());
        $reserved = $repository->reserveItemForFulfiller($itemId, $user['email']);
        if ($reserved === null) {
            return JsonResponse::error($response, 'WISH_NOT_AVAILABLE', 409);
        }

        return JsonResponse::success($response, ['item' => $reserved]);
    }
}
