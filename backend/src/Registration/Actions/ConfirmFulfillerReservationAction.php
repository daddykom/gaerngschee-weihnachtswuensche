<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\FulfillerReservationService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Mail\EmailSender;
use App\Shared\Mail\EmailSenderInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class ConfirmFulfillerReservationAction
{
    public function __construct(
        private readonly ?FulfillerReservationService $reservations = null,
        private readonly ?FrontendConfigRepository $configs = null,
        private readonly ?EmailSenderInterface $emails = null,
        private readonly ?EmailQueueRepository $queue = null,
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
        $handover = [
            'date' => $configs->findValueByVariableName('fulfiller_handover_date'),
            'time' => $configs->findValueByVariableName('fulfiller_handover_time'),
            'location' => $configs->findValueByVariableName('fulfiller_handover_location'),
        ];
        $emails = $this->emails ?? new EmailSender();
        $message = $emails->renderFulfillerReservationConfirmation(
            $result['wish'],
            $handover,
        );
        try {
            $emails->sendStoredEmail(
                (string) $result['email'],
                $message['subject'],
                $message['html'],
                $message['text'],
            );
        } catch (Throwable $exception) {
            ($this->queue ?? new EmailQueueRepository(Database::getConnection()))->enqueue(
                'fulfiller_reservation',
                (string) $result['wish']['id'],
                'fulfiller_reservation_confirmation',
                (string) $result['email'],
                $message,
                $exception->getMessage(),
            );
            ExceptionLogger::log('Fulfiller reservation confirmation email queued', $exception);
        }

        return JsonResponse::success($response, [
            'wish' => $result['wish'],
            'handover' => $handover,
        ]);
    }
}
