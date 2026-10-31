<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\RegistrationTokenService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class StartFulfillerRegistrationAction
{
    public function __construct(
        private readonly ?AnmeldungService $anmeldung = null,
        private readonly ?RegistrationTokenService $tokens = null,
        private readonly ?FrontendConfigRepository $configs = null,
        private readonly ?DateTimeImmutable $now = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $data = JsonRequest::body($request);
        $email = JsonRequest::string($data, 'email', 254);
        $locale = strtolower(JsonRequest::string($data, 'language') ?? 'de');
        if ($email === null || filter_var(trim($email), FILTER_VALIDATE_EMAIL) === false) {
            return JsonResponse::error($response, 'INVALID_EMAIL', 422);
        }
        if (($data['privacyAccepted'] ?? false) !== true) {
            return JsonResponse::error($response, 'PRIVACY_CONSENT_REQUIRED', 422);
        }
        if ($locale !== 'de') {
            return JsonResponse::error($response, 'UNSUPPORTED_LANGUAGE', 422);
        }
        $campaignStatus = ($this->configs ?? new FrontendConfigRepository(Database::getConnection()))->campaignStatus($this->now);
        if ($campaignStatus !== 'open') {
            return JsonResponse::error($response, $campaignStatus === 'ended' ? 'CAMPAIGN_ENDED' : 'CAMPAIGN_NOT_STARTED', 403);
        }

        try {
            $acceptedAt = $this->now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $token = ($this->tokens ?? new RegistrationTokenService())->issue(
                strtolower(trim($email)),
                $this->now,
                RegistrationTokenService::FULFILLER,
                $acceptedAt,
            )['token'];
            $baseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
            ($this->anmeldung ?? new AnmeldungService(new \App\Shared\Mail\EmailSender()))->sendFulfillerLink(
                $email,
                $baseUrl . '/fulfiller-login?token=' . rawurlencode($token),
                $locale,
            );
        } catch (Throwable $exception) {
            ExceptionLogger::log('Fulfiller registration email delivery failed', $exception);
            return JsonResponse::error($response, 'REQUEST_FAILED', 503);
        }

        return JsonResponse::success($response, ['sent' => true], 202);
    }
}
