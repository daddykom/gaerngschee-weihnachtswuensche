<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Mail\EmailSender;
use App\Shared\Mail\EmailSenderInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminOrderUpdateAction
{
    public function __construct(
        private readonly ?OrderRepository $orders = null,
        private readonly ?EmailSenderInterface $emails = null,
        private readonly ?EmailQueueRepository $emailQueue = null,
    ) {
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
                'currentTitle' => is_string($item['currentTitle'] ?? null)
                    ? $item['currentTitle']
                    : (is_string($item['currentDescription'] ?? null) ? $item['currentDescription'] : ''),
                'currentDescription' => is_string($item['currentDescription'] ?? null) ? $item['currentDescription'] : '',
                'personalMessage' => is_string($item['personalMessage'] ?? null)
                    ? $item['personalMessage']
                    : (is_string($item['currentReason'] ?? null) ? $item['currentReason'] : null),
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
        if (!$this->validPersonAssignments(
            $current['items'],
            $this->integer($order['adultsCount'] ?? null) ?? 0,
            $this->integer($order['childrenCount'] ?? null) ?? 0,
        )) {
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

        $mailStatus = null;
        $emailType = null;
        if ($requestedStatus === 'changes_requested' && $current['status'] !== 'changes_requested') {
            $mailStatus = 'changes_requested';
            $emailType = 'order_changes_requested';
        } elseif ($requestedStatus === 'definitive' && $current['status'] !== 'definitive') {
            $mailStatus = 'definitive';
            $emailType = 'order_definitive';
        }
        if ($mailStatus !== null && $emailType !== null && is_string($saved['requesterEmail'] ?? null)) {
            $emailOrder = $saved;
            unset($emailOrder['adminNotes']);
            $emailOrder['items'] = array_map(static function (array $item): array {
                unset($item['adminNotes']);
                return $item;
            }, $emailOrder['items'] ?? []);
            $emailOrder['loginUrl'] = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/') . '/login';
            $emails = $this->emails ?? new EmailSender();
            $message = $emails->renderOrderConfirmation($emailOrder, $mailStatus);
            try {
                $emails->sendStoredEmail($saved['requesterEmail'], $message['subject'], $message['html'], $message['text']);
            } catch (\Throwable $exception) {
                ($this->emailQueue ?? new EmailQueueRepository(Database::getConnection()))->enqueue(
                    'order',
                    $orderId,
                    $emailType,
                    $saved['requesterEmail'],
                    $message,
                    $exception->getMessage(),
                );
            }
        }

        return JsonResponse::success($response, ['order' => $saved]);
    }

    /** @param list<array<string, mixed>> $items */
    private function validPersonAssignments(array $items, int $adultsCount, int $childrenCount): bool
    {
        $assigned = [];
        foreach ($items as $item) {
            $type = $item['personType'] ?? null;
            $index = $item['personIndex'] ?? null;
            if ($type === null || $index === null) {
                continue;
            }
            if (!in_array($type, ['adult', 'child'], true) || !is_int($index)) {
                return false;
            }
            $maximum = $type === 'adult' ? $adultsCount : $childrenCount;
            if ($index < 1 || $index > $maximum) {
                return false;
            }
            $key = $type . ':' . $index;
            if (isset($assigned[$key])) {
                return false;
            }
            $assigned[$key] = true;
        }
        return true;
    }

    private function integer(mixed $value): ?int
    {
        return is_int($value) ? $value : (is_string($value) && filter_var($value, FILTER_VALIDATE_INT) !== false ? (int) $value : null);
    }
}
