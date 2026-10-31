<?php

declare(strict_types=1);

namespace App\Registration\Data;

use DateTimeImmutable;
use PDO;

final class RegistrationTokenRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function invalidateActiveForEmail(string $email, string $purpose, DateTimeImmutable $now): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE registration_tokens
             SET used_at = :used_at, updated_at = :updated_at
              WHERE email = :email AND purpose = :purpose
               AND used_at IS NULL
               AND expires_at > :now',
        );
        $timestamp = $now->format('Y-m-d H:i:s');
        $stmt->execute([
            'email' => $email,
            'purpose' => $purpose,
            'used_at' => $timestamp,
            'updated_at' => $timestamp,
            'now' => $timestamp,
        ]);
    }

    public function create(
        string $email,
        string $purpose,
        string $tokenHash,
        DateTimeImmutable $expiresAt,
        ?DateTimeImmutable $privacyAcceptedAt = null,
    ): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO registration_tokens
                (id, email, purpose, privacy_accepted_at, token_hash, expires_at)
             VALUES (:id, :email, :purpose, :privacy_accepted_at, :token_hash, :expires_at)',
        );
        $stmt->execute([
            'id' => $this->createUuid(),
            'email' => $email,
            'purpose' => $purpose,
            'privacy_accepted_at' => $privacyAcceptedAt?->format('Y-m-d H:i:s'),
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
        ]);
    }

    public function findValid(string $tokenHash, string $purpose, DateTimeImmutable $now): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, email, purpose, token_hash, expires_at, used_at
             FROM registration_tokens
              WHERE token_hash = :token_hash AND purpose = :purpose
               AND used_at IS NULL
               AND expires_at > :now',
        );
        $stmt->execute([
            'token_hash' => $tokenHash,
            'purpose' => $purpose,
            'now' => $now->format('Y-m-d H:i:s'),
        ]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function consume(string $id, DateTimeImmutable $now): bool
    {
        $timestamp = $now->format('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare(
            'UPDATE registration_tokens
             SET used_at = :used_at, updated_at = :updated_at
             WHERE id = :id
               AND used_at IS NULL
               AND expires_at > :now',
        );
        $stmt->execute([
            'id' => $id,
            'used_at' => $timestamp,
            'updated_at' => $timestamp,
            'now' => $timestamp,
        ]);

        return $stmt->rowCount() === 1;
    }

    public function deleteExpiredBefore(DateTimeImmutable $cutoff): int
    {
        $statement = $this->pdo->prepare(
            'DELETE FROM registration_tokens WHERE expires_at <= :cutoff',
        );
        $statement->execute(['cutoff' => $cutoff->format('Y-m-d H:i:s')]);

        return $statement->rowCount();
    }

    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
