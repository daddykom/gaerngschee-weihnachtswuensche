<?php

declare(strict_types=1);

namespace App\Shared\Mail;

use PDO;

final class EmailQueueRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @param array{subject: string, html: string, text: string} $message */
    public function enqueue(
        string $referenceType,
        string $referenceId,
        string $type,
        string $recipient,
        array $message,
        string $error,
    ): void {
        $values = [
            'id' => $this->uuid(),
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'email_type' => $type,
            'recipient' => $recipient,
            'subject' => $message['subject'],
            'html_body' => $message['html'],
            'text_body' => $message['text'],
            'last_error' => $error,
        ];
        $existing = $this->pdo->prepare(
            'SELECT id FROM email_queue
             WHERE reference_type = :reference_type
               AND reference_id = :reference_id
               AND email_type = :email_type',
        );
        $existing->execute([
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'email_type' => $type,
        ]);
        if ($existing->fetchColumn() !== false) {
            $statement = $this->pdo->prepare(
                'UPDATE email_queue SET last_error = :last_error, updated_at = CURRENT_TIMESTAMP
                 WHERE reference_type = :reference_type
                   AND reference_id = :reference_id
                   AND email_type = :email_type',
            );
            $statement->execute([
                'last_error' => $error,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'email_type' => $type,
            ]);
            return;
        }
        $statement = $this->pdo->prepare(
            'INSERT INTO email_queue
                (id, reference_type, reference_id, email_type, recipient, subject, html_body, text_body, last_error)
             VALUES (:id, :reference_type, :reference_id, :email_type, :recipient, :subject, :html_body, :text_body, :last_error)',
        );
        $statement->execute($values);
    }

    /** @return list<array<string, mixed>> */
    public function pending(): array
    {
        return $this->pdo->query(
            'SELECT id, reference_type, reference_id, email_type, recipient, subject, html_body, text_body
             FROM email_queue ORDER BY created_at, id',
        )->fetchAll();
    }

    public function hasPendingForReference(string $referenceType, string $referenceId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM email_queue
             WHERE reference_type = :reference_type AND reference_id = :reference_id LIMIT 1',
        );
        $statement->execute([
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
        ]);
        return $statement->fetchColumn() !== false;
    }

    public function remove(string $id): void
    {
        $statement = $this->pdo->prepare('DELETE FROM email_queue WHERE id = :id');
        $statement->execute(['id' => $id]);
    }

    public function recordFailure(string $id, string $error): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE email_queue SET last_error = :last_error, updated_at = CURRENT_TIMESTAMP WHERE id = :id',
        );
        $statement->execute(['id' => $id, 'last_error' => $error]);
    }

    private function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
