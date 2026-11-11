<?php

declare(strict_types=1);

namespace App\Registration\Data;

use DateInterval;
use DateTimeImmutable;
use PDO;

final class FairgateRegistrationRequestRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function saveWaiting(string $email, DateTimeImmutable $now): void
    {
        $email = $this->normalizeEmail($email);
        $timestamp = $now->format('Y-m-d H:i:s');

        $existing = $this->findByEmail($email);
        if ($existing !== null) {
            $statement = $this->pdo->prepare(
                'UPDATE fairgate_registration_requests
                 SET requested_at = :requested_at,
                     last_checked_at = NULL,
                     fairgate_found_at = NULL, notification_sent_at = NULL,
                     updated_at = :updated_at
                 WHERE email = :email',
            );
            $statement->execute([
                'email' => $email,
                'requested_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);

            return;
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO fairgate_registration_requests
                 (id, email, requested_at, created_at, updated_at)
             VALUES (:id, :email, :requested_at, :created_at, :updated_at)',
        );
        $statement->execute([
            'id' => $this->createUuid(),
            'email' => $email,
            'requested_at' => $timestamp,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    /** @return list<array<string, mixed>> */
    public function findDue(DateTimeImmutable $now, DateInterval $interval): array
    {
        $cutoff = $now->sub($interval)->format('Y-m-d H:i:s');
        $statement = $this->pdo->prepare(
            'SELECT id, email, requested_at, last_checked_at,
                    fairgate_found_at, notification_sent_at, created_at, updated_at
             FROM fairgate_registration_requests
             WHERE notification_sent_at IS NULL
               AND (last_checked_at IS NULL OR last_checked_at <= :cutoff)
             ORDER BY requested_at, id',
        );
        $statement->execute([
            'cutoff' => $cutoff,
        ]);

        return $statement->fetchAll();
    }

    public function markChecked(string $id, DateTimeImmutable $checkedAt): void
    {
        $timestamp = $checkedAt->format('Y-m-d H:i:s');
        $statement = $this->pdo->prepare(
            'UPDATE fairgate_registration_requests
             SET last_checked_at = :last_checked_at, updated_at = :updated_at
             WHERE id = :id AND notification_sent_at IS NULL',
        );
        $statement->execute([
            'id' => $id,
            'last_checked_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    public function markNotificationSent(string $id, DateTimeImmutable $foundAt, DateTimeImmutable $sentAt): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE fairgate_registration_requests
             SET last_checked_at = :last_checked_at,
                 fairgate_found_at = :fairgate_found_at,
                 notification_sent_at = :notification_sent_at,
                 updated_at = :updated_at
             WHERE id = :id AND notification_sent_at IS NULL',
        );
        $statement->execute([
            'id' => $id,
            'last_checked_at' => $foundAt->format('Y-m-d H:i:s'),
            'fairgate_found_at' => $foundAt->format('Y-m-d H:i:s'),
            'notification_sent_at' => $sentAt->format('Y-m-d H:i:s'),
            'updated_at' => $sentAt->format('Y-m-d H:i:s'),
        ]);
    }

    /** @return array<string, mixed>|null */
    private function findByEmail(string $email): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, email, requested_at, last_checked_at,
                    fairgate_found_at, notification_sent_at, created_at, updated_at
             FROM fairgate_registration_requests WHERE email = :email',
        );
        $statement->execute(['email' => $email]);
        $row = $statement->fetch();

        return $row ?: null;
    }

    private function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
