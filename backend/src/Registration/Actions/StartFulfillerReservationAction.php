<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\FulfillerReservationService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class StartFulfillerReservationAction
{
    public function __construct(
        private readonly ?AnmeldungService $anmeldung = null,
        private readonly ?FulfillerReservationService $reservations = null,
        private readonly ?FrontendConfigRepository $configs = null,
        private readonly ?DateTimeImmutable $now = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $data = JsonRequest::body($request);
        $itemId = JsonRequest::string($data, 'itemId', 36);
        $email = JsonRequest::string($data, 'email', 254);
        $locale = strtolower(JsonRequest::string($data, 'language') ?? 'de');
        if ($itemId === null) {
            return JsonResponse::error($response, 'INVALID_WISH_DATA', 422);
        }
        if ($email === null || filter_var(trim($email), FILTER_VALIDATE_EMAIL) === false) {
            return JsonResponse::error($response, 'INVALID_EMAIL', 422);
        }
        if (($data['privacyAccepted'] ?? false) !== true) {
            return JsonResponse::error($response, 'PRIVACY_CONSENT_REQUIRED', 422);
        }
        if ($locale !== 'de') {
            return JsonResponse::error($response, 'UNSUPPORTED_LANGUAGE', 422);
        }

        try {
            $acceptedAt = $this->now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $result = ($this->reservations ?? new FulfillerReservationService())->request(
                $itemId,
                $email,
                $acceptedAt,
                $this->now,
            );
            if ($result === null) {
                return JsonResponse::error($response, 'WISH_NOT_AVAILABLE', 409);
            }

            $baseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
            ($this->anmeldung ?? new AnmeldungService(new \App\Shared\Mail\EmailSender()))->sendFulfillerReservationLink(
                $email,
                $baseUrl . '/fulfiller-reservation?token=' . rawurlencode($result['token']),
                $result['wish'],
                $locale,
            );
        } catch (Throwable $exception) {
            if (isset($result['token'])) {
                try {
                    ($this->reservations ?? new FulfillerReservationService())->cancel($result['token'], $this->now);
                } catch (Throwable $cancelException) {
                    ExceptionLogger::log('Fulfiller reservation cancellation failed', $cancelException);
                }
            }
            ExceptionLogger::log('Fulfiller reservation email delivery failed', $exception);

            return JsonResponse::error($response, 'REQUEST_FAILED', 503);
        }

        return JsonResponse::success($response, [
            'sent' => true,
            'itemId' => $itemId,
            'reservationExpiresAt' => $result['expiresAt'],
        ], 202);
    }
}
