<?php

declare(strict_types=1);

namespace App\Registration\Data;

use DateTimeImmutable;
use PDO;

final class FulfillerReservationTokenRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function create(
        string $id,
        string $itemId,
        string $email,
        string $tokenHash,
        DateTimeImmutable $expiresAt,
        DateTimeImmutable $privacyAcceptedAt,
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO fulfiller_reservation_tokens
                (id, order_item_id, email, token_hash, expires_at, privacy_accepted_at)
             VALUES (:id, :order_item_id, :email, :token_hash, :expires_at, :privacy_accepted_at)',
        );
        $statement->execute([
            'id' => $id,
            'order_item_id' => $itemId,
            'email' => strtolower(trim($email)),
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
            'privacy_accepted_at' => $privacyAcceptedAt->format('Y-m-d H:i:s'),
        ]);
    }

    /** @return array<string, mixed>|null */
    public function findValid(string $tokenHash, DateTimeImmutable $now): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, order_item_id, email, expires_at
             FROM fulfiller_reservation_tokens
             WHERE token_hash = :token_hash
               AND used_at IS NULL
               AND expires_at > :now',
        );
        $statement->execute([
            'token_hash' => $tokenHash,
            'now' => $now->format('Y-m-d H:i:s'),
        ]);
        $token = $statement->fetch();

        return is_array($token) ? $token : null;
    }

    public function confirm(string $id, DateTimeImmutable $now): bool
    {
        $timestamp = $now->format('Y-m-d H:i:s');
        $statement = $this->pdo->prepare(
            'UPDATE fulfiller_reservation_tokens
             SET used_at = :used_at, privacy_confirmed_at = :privacy_confirmed_at, updated_at = :updated_at
             WHERE id = :id AND used_at IS NULL AND expires_at > :now',
        );
        $statement->execute([
            'id' => $id,
            'used_at' => $timestamp,
            'privacy_confirmed_at' => $timestamp,
            'updated_at' => $timestamp,
            'now' => $timestamp,
        ]);

        return $statement->rowCount() === 1;
    }

    public function invalidate(string $id, DateTimeImmutable $now): void
    {
        $timestamp = $now->format('Y-m-d H:i:s');
        $statement = $this->pdo->prepare(
            'UPDATE fulfiller_reservation_tokens
             SET used_at = :used_at, updated_at = :updated_at
             WHERE id = :id AND used_at IS NULL',
        );
        $statement->execute([
            'id' => $id,
            'used_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }
}
