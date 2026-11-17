<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderStatisticsRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class AdminStatisticsAction
{
    public function __construct(
        private readonly ?OrderStatisticsRepository $statistics = null,
        private readonly ?FrontendConfigRepository $config = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        try {
            $config = $this->config ?? new FrontendConfigRepository(Database::getConnection());
            $statistics = $this->statistics ?? new OrderStatisticsRepository(Database::getConnection());
            return JsonResponse::success($response, $statistics->forYear($config->findCampaignYear()));
        } catch (Throwable $exception) {
            ExceptionLogger::log('Admin statistics load failed', $exception);
            return JsonResponse::error($response, 'STATISTICS_LOAD_FAILED', 500);
        }
    }
}
