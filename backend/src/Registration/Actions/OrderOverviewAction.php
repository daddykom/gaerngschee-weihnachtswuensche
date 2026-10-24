<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Services\FairgateContactProvider;
use App\Fairgate\Services\FairgateContactProviderFactory;
use App\Fairgate\Services\FairgateOrderDataEvaluator;
use App\Fairgate\Services\FairgateException;
use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use DateTimeImmutable;
use DateTimeZone;

final class OrderOverviewAction
{
    public function __construct(
        private readonly ?OrderRepository $orders = null,
        private readonly ?FrontendConfigRepository $config = null,
        private readonly ?FairgateContactProvider $fairgate = null,
        private readonly ?FairgateOrderDataEvaluator $evaluator = null,
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
        $fairgate = $this->fairgate ?? FairgateContactProviderFactory::create();
        $year = $config->findCampaignYear();
        $order = $orders->findForYear($user['id'], $year);
        try {
            $data = $fairgate->findContactDataByEmail($user['email'], 'Klient*innen')['data'] ?? null;
        } catch (FairgateException $exception) {
            return JsonResponse::error($response, 'FAIRGATE_LOOKUP_FAILED', 502);
        }
        $valid = is_array($data) && $this->hasUsableData($data);

        $evaluation = $valid
            ? ($this->evaluator ?? new FairgateOrderDataEvaluator())->evaluate(
                $data,
                new DateTimeImmutable('now', new DateTimeZone('UTC')),
                $year,
            )
            : ['status' => 'not_found', 'valid' => false, 'childrenCount' => null, 'adultsCount' => null];

        $payload = [
            'order' => $order,
            'year' => $year,
            'fairgateStatus' => $evaluation['status'],
            'fairgateUserExists' => $evaluation['valid'],
            'childrenCount' => $evaluation['valid'] ? $evaluation['childrenCount'] : null,
            'adultsCount' => $evaluation['valid'] ? $evaluation['adultsCount'] : null,
        ];

        return JsonResponse::success($response, $payload);
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
