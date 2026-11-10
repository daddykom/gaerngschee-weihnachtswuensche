<?php

declare(strict_types=1);

namespace App\Fairgate\Data;

use DateTimeImmutable;
use InvalidArgumentException;
use PDO;

final class FairgateContactRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function upsert(string $fairgateContactId, string $email, DateTimeImmutable $now): void
    {
        $email = strtolower(trim($email));
        if ($fairgateContactId === '' || trim($fairgateContactId) !== $fairgateContactId || strlen($fairgateContactId) > 255) {
            throw new InvalidArgumentException('Invalid Fairgate contact ID.');
        }
        if (strlen($email) > 255 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Invalid Fairgate contact email.');
        }

        $timestamp = $now->format('Y-m-d H:i:s');
        $existing = $this->findByFairgateId($fairgateContactId);
        if ($existing !== null) {
            $statement = $this->pdo->prepare(
                'UPDATE fairgate_contacts SET email = :email, updated_at = :updated_at
                 WHERE fairgate_contact_id = :fairgate_contact_id',
            );
            $statement->execute([
                'email' => $email,
                'updated_at' => $timestamp,
                'fairgate_contact_id' => $fairgateContactId,
            ]);

            return;
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO fairgate_contacts (id, email, fairgate_contact_id, created_at, updated_at)
             VALUES (:id, :email, :fairgate_contact_id, :created_at, :updated_at)',
        );
        $statement->execute([
            'id' => $this->createUuid(),
            'email' => $email,
            'fairgate_contact_id' => $fairgateContactId,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, email, fairgate_contact_id, created_at, updated_at FROM fairgate_contacts WHERE email = :email',
        );
        $statement->execute(['email' => strtolower(trim($email))]);

        return $statement->fetch() ?: null;
    }

    /** @return array<string, mixed>|null */
    public function findByFairgateId(string $fairgateContactId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, email, fairgate_contact_id, created_at, updated_at FROM fairgate_contacts
             WHERE fairgate_contact_id = :fairgate_contact_id',
        );
        $statement->execute(['fairgate_contact_id' => $fairgateContactId]);

        return $statement->fetch() ?: null;
    }

    /**
     * Call only with the IDs from a complete, successful membership snapshot.
     * An empty snapshot removes all contacts.
     *
     * @param list<string> $fairgateContactIds
     */
    public function deleteNotIn(array $fairgateContactIds): int
    {
        if ($fairgateContactIds === []) {
            return $this->pdo->exec('DELETE FROM fairgate_contacts');
        }

        $placeholders = implode(', ', array_fill(0, count($fairgateContactIds), '?'));
        $statement = $this->pdo->prepare(
            'DELETE FROM fairgate_contacts WHERE fairgate_contact_id NOT IN (' . $placeholders . ')',
        );
        $statement->execute($fairgateContactIds);

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
