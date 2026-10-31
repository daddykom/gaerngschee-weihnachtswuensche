<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminOrderUpdateAction
{
    public function __construct(private readonly ?OrderRepository $orders = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $data = JsonRequest::body($request);
        $orderId = (string) ($args['orderId'] ?? '');
        $order = is_array($data['order'] ?? null) ? $data['order'] : null;
        $items = is_array($data['items'] ?? null) ? $data['items'] : null;
        $action = is_string($data['action'] ?? null) ? $data['action'] : 'save';
        if ($order === null || $items === null || ($order['id'] ?? null) !== $orderId) {
            return JsonResponse::error($response, 'INVALID_ORDER_DATA', 422);
        }

        $repository = $this->orders ?? new OrderRepository(Database::getConnection());
        $current = $repository->findById($orderId);
        if ($current === null) {
            return JsonResponse::error($response, 'ORDER_NOT_FOUND', 404);
        }

        if (!in_array($action, ['save', 'release', 'rejectOrder', 'acceptItem', 'rejectItem'], true)
            || !in_array($order['status'] ?? null, ['released', 'in_review', 'changes_requested', 'definitive'], true)) {
            return JsonResponse::error($response, 'INVALID_ORDER_DATA', 422);
        }

        $normalizedItems = [];
        $allApproved = true;
        foreach ($items as $item) {
            if (!is_array($item) || !is_string($item['id'] ?? null) || !in_array($item['publicationStatus'] ?? null, ['approved', 'rejected', 'submitted'], true)) {
                return JsonResponse::error($response, 'INVALID_ORDER_DATA', 422);
            }
            $publicationStatus = (string) $item['publicationStatus'];
            $adminNotes = $item['adminNotes'] ?? null;
            if ($publicationStatus === 'rejected' && (!is_string($adminNotes) || trim($adminNotes) === '')) {
                return JsonResponse::error($response, 'REJECTION_REASON_REQUIRED', 422);
            }
            $allApproved = $allApproved && $publicationStatus === 'approved';
            $normalizedItems[] = [
                'id' => $item['id'],
                'currentDescription' => is_string($item['currentDescription'] ?? null) ? $item['currentDescription'] : '',
                'currentReason' => is_string($item['currentReason'] ?? null) ? $item['currentReason'] : null,
                'publicationStatus' => $publicationStatus,
                'adminNotes' => is_string($adminNotes) ? $adminNotes : null,
            ];
        }
        $currentItemIds = array_map(static fn (array $item): string => (string) $item['id'], $current['items']);
        $submittedItemIds = array_map(static fn (array $item): string => (string) $item['id'], $normalizedItems);
        sort($currentItemIds);
        sort($submittedItemIds);
        if ($currentItemIds !== $submittedItemIds) {
            return JsonResponse::error($response, 'INVALID_ORDER_DATA', 422);
        }

        $requestedStatus = is_string($order['status'] ?? null) ? $order['status'] : $current['status'];
        if ($requestedStatus === 'definitive' && $action !== 'release') {
            return JsonResponse::error($response, 'INVALID_ORDER_DATA', 422);
        }
        if ($action === 'release' && !$allApproved) {
            return JsonResponse::error($response, 'ITEMS_NOT_ACCEPTED', 422);
        }
        if ($action === 'release') {
            $requestedStatus = 'definitive';
        }
        if (in_array('rejected', array_column($normalizedItems, 'publicationStatus'), true)) {
            $requestedStatus = 'changes_requested';
        }
        if ($action === 'rejectOrder' && !in_array('rejected', array_column($normalizedItems, 'publicationStatus'), true)
            && (!is_string($order['adminNotes'] ?? null) || trim($order['adminNotes']) === '')) {
            return JsonResponse::error($response, 'ORDER_REJECTION_REASON_REQUIRED', 422);
        }
        if ($action === 'rejectOrder') {
            $requestedStatus = 'changes_requested';
        }

        try {
            $saved = $repository->saveAdministration([
                'id' => $orderId,
                'status' => $requestedStatus,
                'currentText' => $order['currentText'] ?? null,
                'adminNotes' => $order['adminNotes'] ?? null,
                'adultsCount' => $order['adultsCount'] ?? 0,
                'childrenCount' => $order['childrenCount'] ?? 0,
            ], $normalizedItems);
        } catch (\Throwable) {
            return JsonResponse::error($response, 'ORDER_UPDATE_FAILED', 500);
        }

        return JsonResponse::success($response, ['order' => $saved]);
    }
}
