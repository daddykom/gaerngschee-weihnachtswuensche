<?php

declare(strict_types=1);

namespace App\Fairgate\Actions;

use Closure;
use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Services\FairgateContactProviderFactory;
use App\Fairgate\Services\FairgateException;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class FairgateTestAction
{
    private const TEST_EMAIL_VARIABLE = 'fairgate_test_email';

    /** @param callable(string): array<string, mixed>|null $lookup */
    public function __construct(
        ?callable $lookup = null,
        private readonly ?FrontendConfigRepository $configs = null,
    ) {
        $this->lookup = $lookup === null ? null : Closure::fromCallable($lookup);
    }

    /** @var Closure(string): array<string, mixed>|null */
    private readonly ?Closure $lookup;

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        try {
            $email = $this->testEmail();
            $lookup = $this->lookup ?? FairgateContactProviderFactory::createReal()->findContactDataByEmail(...);

            return JsonResponse::success($response, [
                'email' => $email,
                'fairgate' => $lookup($email),
            ]);
        } catch (FairgateException $exception) {
            ExceptionLogger::log('Fairgate test failed', $exception);
            return JsonResponse::error($response, 'FAIRGATE_TEST_FAILED', 502);
        }
    }

    private function testEmail(): string
    {
        $value = ($this->configs ?? new FrontendConfigRepository(Database::getConnection()))
            ->findValueByVariableName(self::TEST_EMAIL_VARIABLE);
        if (!is_string($value) || filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            throw new FairgateException('Missing or invalid Fairgate test email configuration.');
        }

        return strtolower(trim($value));
    }
}
