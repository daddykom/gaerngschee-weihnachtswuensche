<?php

declare(strict_types=1);

namespace App\Fairgate\Actions;

use App\Fairgate\Services\FairgateContactProviderFactory;
use App\Fairgate\Services\FairgateException;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Closure;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class FairgateLookupAction
{
    /** @param callable(string, ?string): array<string, mixed>|null $lookup */
    public function __construct(?callable $lookup = null)
    {
        $this->lookup = $lookup === null ? null : Closure::fromCallable($lookup);
    }

    /** @var Closure(string, ?string): array<string, mixed>|null */
    private readonly ?Closure $lookup;

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $email = strtolower(trim((string) ($request->getQueryParams()['email'] ?? '')));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return JsonResponse::error($response, 'INVALID_EMAIL', 400);
        }
        $membership = trim((string) ($request->getQueryParams()['membership'] ?? ''));
        $membership = $membership === '' ? null : $membership;
        if ($membership !== null && mb_strlen($membership) > 160) {
            return JsonResponse::error($response, 'INVALID_MEMBERSHIP', 400);
        }

        try {
            $lookup = $this->lookup ?? FairgateContactProviderFactory::createReal()->findContactDataByEmail(...);

            return JsonResponse::success($response, [
                'email' => $email,
                'fairgate' => $lookup($email, $membership),
            ]);
        } catch (FairgateException $exception) {
            ExceptionLogger::log('Fairgate lookup failed', $exception);
            return JsonResponse::error($response, 'FAIRGATE_LOOKUP_FAILED', 502);
        }
    }
}
