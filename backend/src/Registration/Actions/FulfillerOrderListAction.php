<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class FulfillerOrderListAction
{
    public function __construct(private readonly ?OrderRepository $orders = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $user = $request->getAttribute('user');
        if (!is_array($user) || !is_string($user['email'] ?? null) || $user['email'] === '') {
            return JsonResponse::error($response, 'SESSION_EXPIRED', 401);
        }

        $query = $request->getQueryParams();
        $search = is_string($query['q'] ?? null) ? trim($query['q']) : '';
        $category = is_string($query['category'] ?? null) && in_array($query['category'], ['gift', 'voucher'], true)
            ? $query['category']
            : null;

        if ($search !== '' && strlen($search) < 3) {
            return JsonResponse::success($response, ['orders' => []]);
        }

        $repository = $this->orders ?? new OrderRepository(Database::getConnection());

        return JsonResponse::success($response, [
            'orders' => $repository->findForFulfiller($user['email'], $search !== '' ? $search : null, $category),
        ]);
    }
}
