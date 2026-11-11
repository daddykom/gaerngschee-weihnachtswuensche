<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Auth\Services\SessionService;
use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\OrderStatus;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class OrderOverviewAction
{
    public function __construct(
        private readonly ?OrderRepository $orders = null,
        private readonly ?FrontendConfigRepository $config = null,
        private readonly ?SessionService $session = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $user = $request->getAttribute('user');
        if (!is_array($user) || !is_string($user['id'] ?? null) || !is_string($user['email'] ?? null)) {
            return JsonResponse::error($response, 'SESSION_EXPIRED', 401);
        }

        $orders = $this->orders ?? new OrderRepository(Database::getConnection());
        $config = $this->config ?? new FrontendConfigRepository(Database::getConnection());
        $year = $config->findCampaignYear();
        $order = $orders->findForYear($user['id'], $year);
        $fairgateData = $order !== null
            ? [
                'status' => $order['fairgateStatus'] ?? 'not_found',
                'adultsCount' => $order['fairgateAdultsCount'],
                'childrenCount' => $order['fairgateChildrenCount'],
            ]
            : ($this->session ?? new SessionService())->getFairgateOrderData($year);
        if ($fairgateData === null) {
            return JsonResponse::error($response, 'SESSION_EXPIRED', 401);
        }
        $valid = $fairgateData['status'] === 'valid'
            && $fairgateData['adultsCount'] !== null
            && $fairgateData['childrenCount'] !== null;

        $payload = [
            'order' => $order,
            'year' => $year,
            'fairgateStatus' => $fairgateData['status'],
            'fairgateUserExists' => $valid,
            'childrenCount' => $valid ? $fairgateData['childrenCount'] : null,
            'adultsCount' => $valid ? $fairgateData['adultsCount'] : null,
            'canEdit' => $order === null || OrderStatus::canClientEdit((string) $order['status']),
        ];

        return JsonResponse::success($response, $payload);
    }
}
