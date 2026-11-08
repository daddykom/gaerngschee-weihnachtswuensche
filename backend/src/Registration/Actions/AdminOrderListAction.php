<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminOrderListAction
{
    public function __construct(private readonly ?OrderRepository $orders = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $query = $request->getQueryParams();
        $statuses = $this->values($query['status'] ?? null);
        $categories = $this->values($query['category'] ?? null);
        $orders = $this->orders ?? new OrderRepository(Database::getConnection());

        return JsonResponse::success($response, [
            'orders' => $orders->findForAdministration($statuses, $categories),
            'statuses' => $statuses,
            'categories' => $categories,
        ]);
    }

    /** @return list<string> */
    private function values(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter($value, static fn (mixed $item): bool => is_string($item) && $item !== ''));
        }
        if (is_string($value) && $value !== '') {
            return array_values(array_filter(explode(',', $value), static fn (string $item): bool => $item !== ''));
        }
        return [];
    }
}
