<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Auth\Services\PasswordPolicy;
use App\Fairgate\Services\FairgateContactProvider;
use App\Fairgate\Services\FairgateContactProviderFactory;
use App\Fairgate\Services\FairgateException;
use App\Fairgate\Services\FairgateOrderDataEvaluator;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Registration\Services\OrderStatus;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Mail\EmailSender;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Data\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class SaveOrderAction
{
    public function __construct(
        private readonly ?OrderRepository $orders = null,
        private readonly ?FrontendConfigRepository $config = null,
        private readonly ?FairgateContactProvider $fairgate = null,
        private readonly ?FairgateOrderDataEvaluator $evaluator = null,
        private readonly ?UserRepository $users = null,
        private readonly ?EmailSenderInterface $emails = null,
        private readonly ?EmailQueueRepository $emailQueue = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $user = $request->getAttribute('user');
        if (!is_array($user) || !is_string($user['id'] ?? null) || !is_string($user['email'] ?? null)) {
            return JsonResponse::error($response, 'SESSION_EXPIRED', 401);
        }

        $body = JsonRequest::body($request);
        $adultsCount = $this->integer($body['adultsCount'] ?? null);
        $childrenCount = $this->integer($body['childrenCount'] ?? null);
        $text = $body['text'] ?? null;
        $items = $this->items($body['items'] ?? null);
        $password = $body['password'] ?? null;
        $passwordConfirmation = $body['passwordConfirmation'] ?? null;
        if ($password === '') {
            $password = null;
        }
        if ($passwordConfirmation === '') {
            $passwordConfirmation = null;
        }
        if ($adultsCount === null || $childrenCount === null || $adultsCount < 0 || $childrenCount < 0
            || !is_string($text) || trim($text) === '' || strlen($text) > 2000 || $items === null) {
            return JsonResponse::error($response, 'INVALID_ORDER', 422);
        }
        if ($password !== null && (!is_string($password) || !PasswordPolicy::accepts($password))) {
            return JsonResponse::error($response, 'WEAK_PASSWORD', 422);
        }

        $config = $this->config ?? new FrontendConfigRepository(Database::getConnection());
        $orders = $this->orders ?? new OrderRepository(Database::getConnection());
        $fairgate = $this->fairgate ?? FairgateContactProviderFactory::create();
        $year = $config->findCampaignYear();
        $existingOrder = $orders->findForYear($user['id'], $year);
        if ($existingOrder !== null && !OrderStatus::canClientEdit((string) $existingOrder['status'])) {
            return JsonResponse::error($response, 'ORDER_NOT_EDITABLE', 409);
        }
        if ($existingOrder === null
            && (!is_string($password)
                || !PasswordPolicy::accepts($password)
                || !is_string($passwordConfirmation)
                || $password !== $passwordConfirmation)) {
            return JsonResponse::error($response, 'WEAK_PASSWORD', 422);
        }

        try {
            $data = $fairgate->findContactDataByEmail($user['email'], ClientRegistrationLoginService::MEMBERSHIP)['data'] ?? null;
        } catch (FairgateException $exception) {
            return JsonResponse::error($response, 'FAIRGATE_LOOKUP_FAILED', 502);
        }

        $evaluation = is_array($data) && $this->hasUsableData($data)
            ? ($this->evaluator ?? new FairgateOrderDataEvaluator())->evaluate(
                $data,
                new DateTimeImmutable('now', new DateTimeZone('UTC')),
                $year,
            )
            : ['status' => 'not_found', 'valid' => false, 'childrenCount' => 0, 'adultsCount' => 1];

        $status = OrderStatus::WAITING_FOR_FAIRGATE;
        if ($evaluation['valid']) {
            $status = $evaluation['adultsCount'] === $adultsCount && $evaluation['childrenCount'] === $childrenCount
                ? OrderStatus::RELEASED
                : OrderStatus::FAMILY_SIZE_EXCEEDED;
        }
        if (count($items) < 1 || count($items) > $adultsCount + $childrenCount) {
            return JsonResponse::error($response, 'INVALID_ORDER_ITEMS', 422);
        }
        $legacyUnassignedIds = array_values(array_map(
            static fn (array $item): string => (string) $item['id'],
            array_filter(
                $existingOrder['items'] ?? [],
                static fn (array $item): bool => ($item['personType'] ?? null) === null,
            ),
        ));
        if (!$this->validPersonAssignments($items, $adultsCount, $childrenCount, $legacyUnassignedIds)) {
            return JsonResponse::error($response, 'INVALID_ORDER_ITEMS', 422);
        }
        if ($password !== null) {
            ($this->users ?? new UserRepository())->updatePassword($user['id'], $password);
        }

        $order = $orders->saveForYear(
            $user['id'],
            $year,
            $status,
            $adultsCount,
            $childrenCount,
            $items,
            $evaluation['status'],
            $text,
            $evaluation['valid'] ? $evaluation['adultsCount'] : null,
            $evaluation['valid'] ? $evaluation['childrenCount'] : null,
        );
        $order['loginUrl'] = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/') . '/login';
        $emails = $this->emails ?? new EmailSender();
        $message = $emails->renderOrderConfirmation($order, 'saved');
        try {
            $emails->sendStoredEmail($user['email'], $message['subject'], $message['html'], $message['text']);
        } catch (\Throwable $exception) {
            ($this->emailQueue ?? new EmailQueueRepository(Database::getConnection()))->enqueue(
                'order',
                (string) $order['id'],
                'order_saved_confirmation',
                $user['email'],
                $message,
                $exception->getMessage(),
            );
        }

        return JsonResponse::success($response, [
            'order' => $order,
            'status' => $status,
            'fairgateUserExists' => $evaluation['valid'],
        ]);
    }

    /** @param mixed $value */
    private function integer(mixed $value): ?int
    {
        return is_int($value) ? $value : (is_string($value) && filter_var($value, FILTER_VALIDATE_INT) !== false ? (int) $value : null);
    }

    /** @param mixed $value
     *  @return list<array{id?: string, category: string, personType: ?string, personIndex: ?int, title: string, description: string, giftLink: ?string, personalMessage: string}>|null
     */
    private function items(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }

        $items = [];
        foreach ($value as $item) {
            if (!is_array($item)) {
                return null;
            }
            $title = $item['title'] ?? ($item['description'] ?? '');
            $description = $item['description'] ?? '';
            $personalMessage = $item['personalMessage'] ?? ($item['reason'] ?? '');
            $personType = $item['personType'] ?? null;
            $personIndex = $this->integer($item['personIndex'] ?? null);
            if ((isset($item['id']) && !is_string($item['id']))
                || !in_array($item['category'] ?? null, ['voucher', 'gift'], true)
                || ($personType !== null && !in_array($personType, ['adult', 'child'], true))
                || ($personType === null && $personIndex !== null)
                || ($personType !== null && $personIndex === null)
                || !is_string($title)
                || trim($title) === ''
                || strlen($title) > 255
                || !is_string($description)
                || strlen($description) > 2000
                || (isset($item['giftLink']) && $item['giftLink'] !== ''
                    && (!is_string($item['giftLink'])
                        || filter_var($item['giftLink'], FILTER_VALIDATE_URL) === false
                        || strlen($item['giftLink']) > 2048))
                || !is_string($personalMessage)
                || strlen($personalMessage) > 2000) {
                return null;
            }
            $items[] = [
                ...(isset($item['id']) && $item['id'] !== '' ? ['id' => $item['id']] : []),
                'category' => $item['category'],
                'personType' => $personType,
                'personIndex' => $personIndex,
                'title' => trim($title),
                'description' => trim($description),
                'giftLink' => isset($item['giftLink']) && $item['giftLink'] !== '' ? trim((string) $item['giftLink']) : null,
                'personalMessage' => trim($personalMessage),
            ];
        }

        return $items;
    }

    /** @param list<array{id?: string, personType: ?string, personIndex: ?int}> $items */
    private function validPersonAssignments(
        array $items,
        int $adultsCount,
        int $childrenCount,
        array $legacyUnassignedIds = [],
    ): bool {
        $assigned = [];
        foreach ($items as $item) {
            if ($item['personType'] === null || $item['personIndex'] === null) {
                if (!in_array($item['id'] ?? null, $legacyUnassignedIds, true)) {
                    return false;
                }
                continue;
            }
            $maximum = $item['personType'] === 'adult' ? $adultsCount : $childrenCount;
            if ($item['personIndex'] < 1 || $item['personIndex'] > $maximum) {
                return false;
            }
            $key = $item['personType'] . ':' . $item['personIndex'];
            if (isset($assigned[$key])) {
                return false;
            }
            $assigned[$key] = true;
        }
        return true;
    }

    /** @param array<string, mixed> $data */
    private function hasUsableData(array $data): bool
    {
        return array_reduce(
            $data,
            static fn (bool $hasValue, mixed $value): bool => $hasValue || (is_scalar($value) && trim((string) $value) !== ''),
            false,
        );
    }
}
