<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Shared\Database\Database;
use App\Shared\Logging\ExternalErrorLogRepository;
use App\Shared\Mail\EmailQueueRepository;
use App\Shared\Mail\EmailSenderInterface;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

final class OrderBatchService
{
    private const TOKEN_RETENTION_CONFIG = 'registration_token_retention_days';

    public function __construct(
        private readonly OrderRepository $orders,
        private readonly EmailQueueRepository $queue,
        private readonly FrontendConfigRepository $config,
        private readonly EmailSenderInterface $emails,
        private readonly RegistrationTokenRepository $tokens,
        private readonly ?ExternalErrorLogRepository $externalErrors = null,
    ) {
    }

    /** @return array{loaded: int, sent: int, queued: int, failed: int, tokensDeleted: int} */
    public function run(): array
    {
        try {
            ($this->externalErrors ?? new ExternalErrorLogRepository(Database::getConnection()))->pruneToConfiguredLimit();
        } catch (Throwable $exception) {
            error_log('External error log cleanup failed: ' . $exception->getMessage());
        }

        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $result = [
            'loaded' => 0,
            'sent' => 0,
            'queued' => 0,
            'failed' => 0,
            'tokensDeleted' => $this->tokens->deleteExpiredBefore($now->modify('-' . $this->tokenRetentionDays() . ' days')),
        ];

        foreach ($this->queue->pending() as $email) {
            try {
                $this->emails->sendStoredEmail($email['recipient'], $email['subject'], $email['html_body'], $email['text_body']);
                $this->queue->remove($email['id']);
                if ($email['email_type'] === 'order_confirmation') {
                    $this->orders->markReleased($email['reference_id']);
                    $this->orders->markConfirmationEmailSent($email['reference_id']);
                }
                $result['sent']++;
            } catch (Throwable $exception) {
                $this->queue->recordFailure($email['id'], $exception->getMessage());
                error_log(sprintf(
                    'Queued email failed: reference=%s error=%s',
                    (string) $email['reference_id'],
                    $exception->getMessage(),
                ));
                $result['failed']++;
            }
        }

        return $result;
    }

    private function tokenRetentionDays(): int
    {
        $value = $this->config->findValueByVariableName(self::TOKEN_RETENTION_CONFIG);
        if (!is_string($value) || !ctype_digit($value) || (int) $value < 1) {
            throw new \RuntimeException('Invalid registration token retention configuration.');
        }

        return (int) $value;
    }
}
