<?php

declare(strict_types=1);

namespace App\Fairgate\Data;

use PDO;
use RuntimeException;
use Throwable;

final class FairgateTokenRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @param callable(array<string, mixed>): mixed $operation */
    public function synchronized(string $scope, callable $operation): mixed
    {
        if ($this->pdo->inTransaction()) {
            throw new RuntimeException('Fairgate token access must run outside application transactions.');
        }

        $sqlite = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
        $suffix = $sqlite ? 'ON CONFLICT(scope) DO NOTHING' : 'ON DUPLICATE KEY UPDATE scope = scope';
        $this->pdo->prepare('INSERT INTO fairgate_api_tokens (id, scope) VALUES (:id, :scope) ' . $suffix)
            ->execute(['id' => $this->uuid(), 'scope' => $scope]);

        $this->pdo->beginTransaction();
        try {
            if ($sqlite) {
                // SQLite has no row locks; this write obtains its transaction-wide writer lock.
                $this->pdo->prepare('UPDATE fairgate_api_tokens SET scope = scope WHERE scope = :scope')
                    ->execute(['scope' => $scope]);
            }
            $query = $this->pdo->prepare('SELECT * FROM fairgate_api_tokens WHERE scope = :scope' . ($sqlite ? '' : ' FOR UPDATE'));
            $query->execute(['scope' => $scope]);
            $row = $query->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new RuntimeException('Fairgate token state is missing.');
            }
            $result = $operation($row);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $exception;
        }
    }

    public function saveTokens(string $scope, ?string $token, ?string $refreshToken, ?int $expiresAt): void
    {
        $this->pdo->prepare(
            'UPDATE fairgate_api_tokens SET access_token = :token, refresh_token = :refresh_token,
             expires_at = :expires_at, auth_retry_after = 0, updated_at = CURRENT_TIMESTAMP WHERE scope = :scope',
        )->execute(['scope' => $scope, 'token' => $token, 'refresh_token' => $refreshToken, 'expires_at' => $expiresAt]);
    }

    public function deferAuthentication(string $scope, int $until): void
    {
        $this->defer($scope, 'auth_retry_after', $until);
    }

    public function deferDataRequests(string $scope, int $until): void
    {
        $this->defer($scope, 'data_retry_after', $until);
    }

    public function deferContactRequests(string $scope, int $until): void
    {
        $this->defer($scope, 'contacts_retry_after', $until);
    }

    private function defer(string $scope, string $column, int $until): void
    {
        $this->pdo->prepare(
            "UPDATE fairgate_api_tokens SET {$column} = CASE WHEN {$column} < :until THEN :deadline ELSE {$column} END,
             updated_at = CURRENT_TIMESTAMP WHERE scope = :scope",
        )->execute(['scope' => $scope, 'until' => $until, 'deadline' => $until]);
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
