<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

use App\Fairgate\Data\FairgateTokenRepository;
use Closure;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Throwable;

final class FairgateTokenService
{
    private readonly Closure $requestToken;
    private readonly Closure $validateToken;
    private readonly Closure $now;

    /**
     * @param callable(?string): array<string, mixed> $requestToken
     * @param callable(string): bool $validateToken
     * @param callable(): int|null $now
     */
    public function __construct(
        private readonly FairgateTokenRepository $tokens,
        private readonly string $scope,
        callable $requestToken,
        callable $validateToken,
        ?callable $now = null,
    ) {
        $this->requestToken = Closure::fromCallable($requestToken);
        $this->validateToken = Closure::fromCallable($validateToken);
        $this->now = Closure::fromCallable($now ?? time(...));
    }

    public function token(?string $rejectedToken = null, bool $contactList = false): string
    {
        try {
            $result = $this->tokens->synchronized($this->scope, function (array $state) use ($rejectedToken, $contactList): string|FairgateException {
                $now = ($this->now)();
                if ((int) $state['data_retry_after'] > $now) {
                    return $this->rateLimited((int) $state['data_retry_after'] - $now);
                }
                if ($contactList && (int) $state['contacts_retry_after'] > $now) {
                    return $this->rateLimited((int) $state['contacts_retry_after'] - $now);
                }
                $token = $state['access_token'];
                if (is_string($token) && $token !== $rejectedToken
                    && (int) $state['expires_at'] > $now + 30 && ($this->validateToken)($token)) {
                    return $token;
                }
                if ((int) $state['auth_retry_after'] > $now) {
                    return $this->rateLimited((int) $state['auth_retry_after'] - $now);
                }
                if (is_string($token) && $token === $rejectedToken) {
                    $this->tokens->saveTokens($this->scope, $token, $state['refresh_token'], 0);
                }

                try {
                    $refreshToken = $state['refresh_token'];
                    if (is_string($refreshToken) && $refreshToken !== '') {
                        try {
                            $response = ($this->requestToken)($refreshToken);
                        } catch (FairgateException $exception) {
                            if (!in_array($exception->getCode(), [400, 401], true)) {
                                throw $exception;
                            }
                            // Only an explicitly rejected refresh token permits a new authentication.
                            $this->tokens->saveTokens($this->scope, null, null, null);
                            $refreshToken = null;
                            $response = ($this->requestToken)(null);
                        }
                    } else {
                        $response = ($this->requestToken)(null);
                    }

                    $token = $response['data']['token'] ?? null;
                    $newRefreshToken = $response['data']['refresh_token'] ?? $refreshToken;
                    $expiresAt = is_string($token) ? $this->expiresAt($token) : null;
                    if (!is_string($token) || !($this->validateToken)($token)
                        || $expiresAt === null || $expiresAt <= ($this->now)() + 30
                        || !is_string($newRefreshToken) || trim($newRefreshToken) === '') {
                        throw new FairgateException('FSA authentication returned invalid token data.');
                    }
                    $this->tokens->saveTokens($this->scope, $token, $newRefreshToken, $expiresAt);
                    return $token;
                } catch (FairgateException $exception) {
                    $this->tokens->deferAuthentication($this->scope, ($this->now)() + ($exception->retryAfter ?? 90));
                    // Return instead of throwing so the cooldown is committed before releasing the lock.
                    return $exception;
                }
            });
        } catch (Throwable $exception) {
            throw new FairgateException('Shared Fairgate token storage is unavailable.', 0, $exception);
        }

        if ($result instanceof FairgateException) {
            throw $result;
        }
        return $result;
    }

    public function deferDataRequests(int $seconds, bool $contactListOnly = false): void
    {
        try {
            $this->tokens->synchronized($this->scope, function () use ($seconds, $contactListOnly): void {
                $until = ($this->now)() + $seconds;
                if ($contactListOnly) {
                    $this->tokens->deferContactRequests($this->scope, $until);
                } else {
                    $this->tokens->deferDataRequests($this->scope, $until);
                }
            });
        } catch (Throwable $exception) {
            throw new FairgateException('Shared Fairgate rate limit storage is unavailable.', 0, $exception);
        }
    }

    public function rejectAccessToken(string $token): void
    {
        try {
            $this->tokens->synchronized($this->scope, function (array $state) use ($token): void {
                if ($state['access_token'] === $token) {
                    $this->tokens->saveTokens($this->scope, $token, $state['refresh_token'], 0);
                    $this->tokens->deferAuthentication($this->scope, ($this->now)() + 90);
                }
            });
        } catch (Throwable $exception) {
            throw new FairgateException('Shared Fairgate token storage is unavailable.', 0, $exception);
        }
    }

    private function rateLimited(int $seconds): FairgateException
    {
        return new FairgateException('Fairgate requests are temporarily rate limited.', 429, retryAfter: $seconds);
    }

    private function expiresAt(string $token): ?int
    {
        try {
            $jwt = (new Parser(new JoseEncoder()))->parse(preg_replace('/^Bearer\s+/i', '', $token));
            $expiry = $jwt instanceof UnencryptedToken ? $jwt->claims()->get('exp') : null;
            return $expiry instanceof \DateTimeImmutable ? $expiry->getTimestamp() : null;
        } catch (Throwable) {
            return null;
        }
    }
}
