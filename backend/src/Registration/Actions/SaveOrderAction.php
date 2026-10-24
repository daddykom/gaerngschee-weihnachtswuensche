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
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
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
        $password = $body['password'] ?? null;
        if ($password === '') {
            $password = null;
        }
        if ($adultsCount === null || $childrenCount === null || $adultsCount < 0 || $childrenCount < 0
            || !is_string($text) || trim($text) === '' || strlen($text) > 2000) {
            return JsonResponse::error($response, 'INVALID_ORDER', 422);
        }
        if ($password !== null && (!is_string($password) || !PasswordPolicy::accepts($password))) {
            return JsonResponse::error($response, 'WEAK_PASSWORD', 422);
        }

        $config = $this->config ?? new FrontendConfigRepository(Database::getConnection());
        $orders = $this->orders ?? new OrderRepository(Database::getConnection());
        $fairgate = $this->fairgate ?? FairgateContactProviderFactory::create();
        $year = $config->findCampaignYear();

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

        $status = $evaluation['valid'] ? 'definitive' : 'provisional';
        $savedAdults = $evaluation['valid'] ? $evaluation['adultsCount'] : $adultsCount;
        $savedChildren = $evaluation['valid'] ? $evaluation['childrenCount'] : $childrenCount;
        if ($password !== null) {
            ($this->users ?? new UserRepository())->updatePassword($user['id'], $password);
        }

        $order = $orders->saveForYear(
            $user['id'],
            $year,
            $status,
            $savedAdults,
            $savedChildren,
            [],
            $evaluation['status'],
            $text,
        );

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
