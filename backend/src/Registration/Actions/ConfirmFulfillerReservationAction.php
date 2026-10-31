<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\FulfillerReservationService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class ConfirmFulfillerReservationAction
{
    public function __construct(
        private readonly ?FulfillerReservationService $reservations = null,
        private readonly ?FrontendConfigRepository $configs = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = JsonRequest::string(JsonRequest::body($request), 'token', 2048);
        if ($token === null) {
            return JsonResponse::error($response, 'INVALID_RESERVATION_TOKEN', 401);
        }

        try {
            $result = ($this->reservations ?? new FulfillerReservationService())->confirm($token);
        } catch (Throwable $exception) {
            ExceptionLogger::log('Fulfiller reservation confirmation failed', $exception);

            return JsonResponse::error($response, 'RESERVATION_CONFIRMATION_FAILED', 503);
        }
        if ($result === null) {
            return JsonResponse::error($response, 'INVALID_RESERVATION_TOKEN', 401);
        }
        if ($result['status'] === 'unavailable') {
            return JsonResponse::error($response, 'WISH_NOT_AVAILABLE', 409);
        }

        $configs = $this->configs ?? new FrontendConfigRepository(Database::getConnection());

        return JsonResponse::success($response, [
            'wish' => $result['wish'],
            'handover' => [
                'date' => $configs->findValueByVariableName('fulfiller_handover_date'),
                'time' => $configs->findValueByVariableName('fulfiller_handover_time'),
                'location' => $configs->findValueByVariableName('fulfiller_handover_location'),
            ],
        ]);
    }
}
