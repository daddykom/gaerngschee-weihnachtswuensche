<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\RegistrationTokenService;
use DateTimeImmutable;
use App\Shared\Database\Database;
use App\Shared\Mail\EmailSender;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class StartRegistrationAction
{
    private const SUPPORTED_LOCALES = ['de'];

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
        if (!in_array($locale, self::SUPPORTED_LOCALES, true)) {
            return JsonResponse::error($response, 'UNSUPPORTED_LANGUAGE', 422);
        }
        $campaignStatus = ($this->configs ?? new FrontendConfigRepository(Database::getConnection()))->campaignStatus($this->now);
        if ($campaignStatus !== 'open') {
            return JsonResponse::error(
                $response,
                $campaignStatus === 'ended' ? 'CAMPAIGN_ENDED' : 'CAMPAIGN_NOT_STARTED',
                403,
            );
        }

        try {
            $token = ($this->tokens ?? new RegistrationTokenService())->issue(strtolower(trim($email)))['token'];
            $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
            $loginUrl = $frontendBaseUrl . '/client-login?token=' . rawurlencode($token);
            ($this->anmeldung ?? self::createService())->sendRegistrationLink($email, $loginUrl, $locale);
        } catch (Throwable $exception) {
            ExceptionLogger::log('Start registration email delivery failed', $exception);
            return JsonResponse::error($response, 'REQUEST_FAILED', 503);
        }

        return JsonResponse::success($response, ['sent' => true], 202);
    }

    private static function createService(): AnmeldungService
    {
        return new AnmeldungService(new EmailSender());
    }

}
