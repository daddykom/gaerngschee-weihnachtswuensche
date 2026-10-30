<?php

declare(strict_types=1);

namespace App\Auth\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class JwtService
{
    private const DEFAULT_ALGORITHM = 'HS256';
    private const DEFAULT_TTL = 3600;
    private const ALLOWED_ALGORITHMS = ['HS256', 'HS384', 'HS512'];

    public function createToken(string $userId, int $tokenVersion = 0): string
    {
        $issuedAt = time();
        $payload = [
            'sub' => $userId,
            'token_version' => $tokenVersion,
            'iss' => $this->getIssuer(),
            'aud' => $this->getAudience(),
            'jti' => bin2hex(random_bytes(16)),
            'iat' => $issuedAt,
            'exp' => $issuedAt + $this->getTtl(),
        ];

        return JWT::encode($payload, $this->getSecret(), $this->getAlgorithm());
    }

    public function verifyToken(string $token): ?array
    {
        try {
            $payload = JWT::decode(
                $token,
                new Key($this->getSecret(), $this->getAlgorithm()),
            );
        } catch (Throwable) {
            return null;
        }

        $claims = (array) $payload;
        if (($claims['iss'] ?? null) !== $this->getIssuer()) {
            return null;
        }

        $audience = $claims['aud'] ?? null;
        if (!is_string($audience) || $audience !== $this->getAudience()) {
            return null;
        }

        if (!is_string($claims['jti'] ?? null) || $claims['jti'] === '') {
            return null;
        }

        if (!is_int($claims['token_version'] ?? null) || $claims['token_version'] < 0) {
            return null;
        }

        return $claims;
    }

    public function getUserIdFromToken(string $token): ?string
    {
        $payload = $this->verifyToken($token);
        $userId = $payload['sub'] ?? null;

        return is_string($userId) && $userId !== '' ? $userId : null;
    }

    public function getBearerToken(ServerRequestInterface $request): ?string
    {
        $authorization = trim($request->getHeaderLine('Authorization'));
        if (preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }

    private function getSecret(): string
    {
        $secret = getenv('JWT_SECRET');
        if ($secret === false || $secret === '') {
            throw new \RuntimeException('JWT_SECRET is not configured.');
        }

        if (strlen($secret) < 32) {
            throw new \RuntimeException('JWT_SECRET must contain at least 32 bytes.');
        }

        return $secret;
    }

    private function getAlgorithm(): string
    {
        $algorithm = getenv('JWT_ALGORITHM') ?: self::DEFAULT_ALGORITHM;
        if (!in_array($algorithm, self::ALLOWED_ALGORITHMS, true)) {
            throw new \RuntimeException('JWT_ALGORITHM is not allowed.');
        }

        return $algorithm;
    }

    private function getIssuer(): string
    {
        return getenv('JWT_ISSUER') ?: 'gaerngschee';
    }

    private function getAudience(): string
    {
        return getenv('JWT_AUDIENCE') ?: 'gaerngschee-frontend';
    }

    private function getTtl(): int
    {
        $ttl = filter_var(getenv('JWT_TTL'), FILTER_VALIDATE_INT);

        return is_int($ttl) && $ttl > 0 ? $ttl : self::DEFAULT_TTL;
    }
}
