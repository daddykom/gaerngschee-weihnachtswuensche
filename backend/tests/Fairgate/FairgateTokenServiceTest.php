<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Data\FairgateTokenRepository;
use App\Fairgate\Services\FairgateException;
use App\Fairgate\Services\FairgateTokenService;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FairgateTestTokens;

final class FairgateTokenServiceTest extends TestCase
{
    private FairgateTokenRepository $tokens;
    private int $now;

    protected function setUp(): void
    {
        $this->tokens = FairgateTestTokens::repository();
        $this->now = time();
    }

    public function testDifferentServiceInstancesReuseTheSameStoredToken(): void
    {
        $calls = [];
        $request = function (?string $refresh) use (&$calls): array {
            $calls[] = $refresh;
            return $this->response();
        };

        $first = $this->service($request)->token();
        self::assertSame($first, $this->service($request)->token());
        self::assertSame([null], $calls);
    }

    public function testExpiredTokensAreRefreshedAndRotatedRefreshTokensAreStored(): void
    {
        $calls = [];
        $request = function (?string $refresh) use (&$calls): array {
            $calls[] = $refresh;
            return $this->response('refresh-' . count($calls));
        };
        $this->service($request)->token();
        $this->now += 3580;
        $second = $this->service($request)->token();
        $this->now += 3600;
        self::assertNotSame($second, $this->service($request)->token());
        self::assertSame([null, 'refresh-1', 'refresh-2'], $calls);
    }

    public function testRefreshCanKeepThePreviousRefreshTokenWhenNoReplacementIsReturned(): void
    {
        $this->service(fn (): array => $this->response())->token();
        $this->now += 3600;
        $calls = [];
        $request = function (?string $refresh) use (&$calls): array {
            $calls[] = $refresh;
            return ['data' => ['token' => FairgateTestTokens::token($this->now + 3600)]];
        };
        $this->service($request)->token();
        $this->now += 3600;
        $this->service($request)->token();
        self::assertSame(['refresh-1', 'refresh-1'], $calls);
    }

    #[DataProvider('rejectedRefreshStatuses')]
    public function testExplicitlyRejectedRefreshTokensPermitOneNewAuthentication(int $status): void
    {
        $this->service(fn (): array => $this->response())->token();
        $this->now += 3600;
        $calls = [];
        $request = function (?string $refresh) use (&$calls, $status): array {
            $calls[] = $refresh;
            if ($refresh !== null) {
                throw new FairgateException('Refresh rejected.', $status);
            }
            return $this->response('replacement');
        };
        self::assertNotEmpty($this->service($request)->token());
        self::assertNotEmpty($this->service($request)->token());
        self::assertSame(['refresh-1', null], $calls);
    }

    public static function rejectedRefreshStatuses(): array
    {
        return [[400], [401], [403]];
    }

    #[DataProvider('failedReplacementStatuses')]
    public function testRejectedRefreshFollowedByFailedAuthenticationStopsAndDiscardsOldCredentials(int $status, ?int $retryAfter): void
    {
        $this->service(fn (): array => $this->response())->token();
        $this->now += 3600;
        $calls = [];
        $request = static function (?string $refresh) use (&$calls, $status, $retryAfter): array {
            $calls[] = $refresh;
            throw new FairgateException('Rejected.', $refresh !== null ? 403 : $status, retryAfter: $refresh !== null ? null : $retryAfter);
        };

        foreach ([$status, 429] as $expectedStatus) {
            try {
                $this->service($request)->token();
                self::fail('A failed replacement must not trigger another authentication.');
            } catch (FairgateException $exception) {
                self::assertSame($expectedStatus, $exception->getCode());
            }
        }
        self::assertSame(['refresh-1', null], $calls);
        $state = $this->tokens->synchronized('test-scope', static fn (array $row): array => $row);
        self::assertNull($state['access_token']);
        self::assertNull($state['refresh_token']);
        self::assertSame($this->now + ($retryAfter ?? 90), (int) $state['auth_retry_after']);
    }

    public static function failedReplacementStatuses(): array
    {
        return [[403, null], [503, null], [429, 120]];
    }

    public function testRefreshServerErrorsDoNotCauseNewAuthenticationOrAnImmediateRetry(): void
    {
        $this->service(fn (): array => $this->response())->token();
        $this->now += 3600;
        $calls = 0;
        $service = $this->service(function (?string $refresh) use (&$calls): array {
            $calls++;
            self::assertSame('refresh-1', $refresh);
            throw new FairgateException('Refresh unavailable.', 503);
        });
        foreach ([503, 429] as $expectedCode) {
            try {
                $service->token();
                self::fail('Authentication must fail without retrying.');
            } catch (FairgateException $exception) {
                self::assertSame($expectedCode, $exception->getCode());
            }
        }
        self::assertSame(1, $calls);
    }

    public function testAuthenticationRateLimitIsSharedAndExpiresWithoutSleeping(): void
    {
        $calls = 0;
        $request = function () use (&$calls): array {
            $calls++;
            if ($calls === 1) {
                throw new FairgateException('Rate limited.', 429, retryAfter: 120);
            }
            return $this->response();
        };
        foreach ([120, 120, 1] as $index => $expectedWait) {
            if ($index === 2) {
                $this->now += 119;
            }
            try {
                $this->service($request)->token();
                self::fail('The cooldown must be observed.');
            } catch (FairgateException $exception) {
                self::assertSame($expectedWait, $exception->retryAfter);
            }
        }
        self::assertSame(1, $calls);
        $this->now++;
        self::assertNotEmpty($this->service($request)->token());
        self::assertSame(2, $calls);
    }

    public function testDataCooldownCannotBeShortenedAndDoesNotCreateNewTokens(): void
    {
        $calls = 0;
        $request = function () use (&$calls): array {
            $calls++;
            return $this->response();
        };
        $service = $this->service($request);
        $token = $service->token();
        $service->deferDataRequests(120);
        $this->service($request)->deferDataRequests(10);
        try {
            $this->service($request)->token();
            self::fail('Data requests must be blocked.');
        } catch (FairgateException $exception) {
            self::assertSame(120, $exception->retryAfter);
        }
        $this->now += 120;
        self::assertSame($token, $this->service($request)->token());
        self::assertSame(1, $calls);
    }

    public function testCooldownStartsWhenTheResponseArrivesRatherThanWhenTheRequestStarted(): void
    {
        $calls = 0;
        $request = function () use (&$calls): array {
            $calls++;
            $this->now += 10;
            throw new FairgateException('Rate limited.', 429, retryAfter: 120);
        };
        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                $this->service($request)->token();
                self::fail('The complete cooldown must be observed.');
            } catch (FairgateException $exception) {
                self::assertSame(120, $exception->retryAfter);
            }
        }
        self::assertSame(1, $calls);
    }

    public function testRejectedAccessTokenIsRefreshedOnlyIfItIsStillCurrent(): void
    {
        $calls = [];
        $request = function (?string $refresh) use (&$calls): array {
            $calls[] = $refresh;
            return ['data' => ['token' => FairgateTestTokens::token($this->now + 3600 + count($calls)), 'refresh_token' => 'refresh-' . count($calls)]];
        };
        $old = $this->service($request)->token();
        $new = $this->service($request)->token($old);
        self::assertNotSame($old, $new);
        self::assertSame($new, $this->service($request)->token($old));
        self::assertSame([null, 'refresh-1'], $calls);
    }

    #[DataProvider('invalidTokenData')]
    public function testInvalidAuthenticationResponsesAreNotStored(array $data): void
    {
        try {
            $this->service(static fn (): array => ['data' => $data])->token();
            self::fail('Invalid token data must not be accepted.');
        } catch (FairgateException) {
            $state = $this->tokens->synchronized('test-scope', static fn (array $row): array => $row);
            self::assertNull($state['access_token']);
            self::assertNull($state['refresh_token']);
            self::assertGreaterThan($this->now, (int) $state['auth_retry_after']);
        }
    }

    public static function invalidTokenData(): array
    {
        return [
            [['token' => 'invalid', 'refresh_token' => 'refresh']],
            [['token' => FairgateTestTokens::token(time() - 1), 'refresh_token' => 'refresh']],
            [['token' => FairgateTestTokens::token()]],
            [['token' => FairgateTestTokens::token(), 'refresh_token' => ' ']],
            [[]],
        ];
    }

    public function testRepositoryFailureDoesNotFallBackToRemoteAuthentication(): void
    {
        $calls = 0;
        $service = new FairgateTokenService(new FairgateTokenRepository(new PDO('sqlite::memory:')), 'scope', function () use (&$calls): array {
            $calls++;
            return $this->response();
        }, static fn (): bool => true);

        try {
            $service->token();
            self::fail('Missing storage must fail closed.');
        } catch (FairgateException $exception) {
            self::assertSame('Shared Fairgate token storage is unavailable.', $exception->getMessage());
            self::assertSame(0, $calls);
        }
    }

    public function testRejectedTokenStaysInvalidWhenRefreshFails(): void
    {
        $token = $this->service(fn (): array => $this->response())->token();
        try {
            $this->service(static function (): array {
                throw new FairgateException('Refresh failed.', 503);
            })->token($token);
            self::fail('The rejected token must not be reused.');
        } catch (FairgateException) {
            $state = $this->tokens->synchronized('test-scope', static fn (array $row): array => $row);
            self::assertSame(0, (int) $state['expires_at']);
            self::assertSame('refresh-1', $state['refresh_token']);
        }
        $this->expectException(FairgateException::class);
        $this->service(static function (): array {
            self::fail('The cooldown must prevent a new request.');
        })->token();
    }

    private function response(string $refresh = 'refresh-1'): array
    {
        return ['data' => ['token' => FairgateTestTokens::token($this->now + 3600), 'refresh_token' => $refresh]];
    }

    private function service(callable $request): FairgateTokenService
    {
        return new FairgateTokenService($this->tokens, 'test-scope', $request, static fn (): bool => true, fn (): int => $this->now);
    }
}
