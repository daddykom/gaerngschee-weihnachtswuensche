<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Services\FairgateContactProvider;
use App\Fairgate\Services\FairgateBatchContactProvider;
use App\Fairgate\Services\FairgateOrderDataEvaluator;
use App\Registration\Data\OrderEmailQueueRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Shared\Mail\EmailSenderInterface;
use App\Shared\Database\Database;
use App\Shared\Logging\ExternalErrorLogRepository;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

final class OrderBatchService
{
    private const INTERVAL_CONFIG = 'fairgate_email_interval_days';
    private const REMINDER_END_DATE_CONFIG = 'fairgate_reminder_end_date';
    private const TOKEN_RETENTION_CONFIG = 'registration_token_retention_days';

    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderEmailQueueRepository $queue,
        private readonly FrontendConfigRepository $config,
        private readonly FairgateContactProvider $fairgate,
        private readonly EmailSenderInterface $emails,
        private readonly RegistrationTokenRepository $tokens,
        private readonly ?ExternalErrorLogRepository $externalErrors = null,
        private readonly ?FairgateOrderDataEvaluator $evaluator = null,
    ) {
    }

    /** @return array{loaded: int, sent: int, queued: int, failed: int, tokensDeleted: int} */
    public function run(): array
    {
        $this->intervalDays();
        try {
            ($this->externalErrors ?? new ExternalErrorLogRepository(Database::getConnection()))->pruneToConfiguredLimit();
        } catch (Throwable $exception) {
            error_log('External error log cleanup failed: ' . $exception->getMessage());
        }
        $retentionDays = $this->tokenRetentionDays();
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $reminderEndDate = $this->reminderEndDate();
        $result = [
            'loaded' => 0,
            'sent' => 0,
            'queued' => 0,
            'failed' => 0,
            'tokensDeleted' => $this->tokens->deleteExpiredBefore($now->modify('-' . $retentionDays . ' days')),
        ];
        $fairgateContacts = $this->fairgateContacts();

        foreach ($this->queue->pending() as $email) {
            if (($email['email_type'] ?? null) === 'fairgate_reminder'
                && !$this->reminderAllowed($reminderEndDate, $now)) {
                $this->queue->remove((string) $email['id']);
                continue;
            }
            try {
                $this->emails->sendStoredEmail($email['recipient'], $email['subject'], $email['html_body'], $email['text_body']);
                $this->queue->remove($email['id']);
                if ($email['email_type'] === 'order_confirmation') {
                    $this->orders->markBatchEmailSent($email['order_id']);
                } else {
                    $this->orders->markFairgateReminderSent($email['order_id']);
                }
                $result['sent']++;
            } catch (Throwable $exception) {
                $this->queue->recordFailure($email['id'], $exception->getMessage());
                $this->log('Queued email failed', $email['order_id'], $exception);
                $result['failed']++;
            }
        }

        foreach ($this->orders->findProvisionalWithUsers() as $entry) {
            $result['loaded']++;
            $order = $entry['order'];
            if ($this->queue->hasPendingForOrder($order['id'])) {
                continue;
            }

            try {
                $data = $this->contactData($entry['email'], $fairgateContacts);
                if (!is_array($data)) {
                    $this->processMissingFairgate($order, $entry['email'], $result, 'not_found', $reminderEndDate, $now);
                    continue;
                }

                $createdAt = new DateTimeImmutable((string) $order['createdAt'], new DateTimeZone('UTC'));
                $evaluation = ($this->evaluator ?? new FairgateOrderDataEvaluator())->evaluate(
                    $data,
                    $createdAt,
                    $this->config->findCampaignYear(),
                );
                if (!$evaluation['valid']) {
                    $this->processMissingFairgate($order, $entry['email'], $result, $evaluation['status'], $reminderEndDate, $now);
                    continue;
                }

                $adults = $evaluation['adultsCount'];
                $children = $evaluation['childrenCount'];
                $corrected = $adults !== $order['adultsCount'] || $children !== $order['childrenCount'];
                if ($corrected) {
                    $this->orders->updateCountsFromBatch($order['id'], $adults, $children);
                    $order = $this->orders->findForYear($order['userId'], $order['year']) ?? $order;
                    $order['correctionNotice'] = true;
                    $order['startUrl'] = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/') . '/start';
                }
                $this->sendConfirmation($order, $entry['email'], $result);
            } catch (Throwable $exception) {
                $this->log('Order batch failed', $order['id'], $exception);
                $result['failed']++;
            }
        }

        return $result;
    }

    /** @return array<string, string>|null */
    private function fairgateContacts(): ?array
    {
        if (!$this->fairgate instanceof FairgateBatchContactProvider) {
            return null;
        }

        $contacts = [];
        foreach ($this->fairgate->findAllContacts() as $contact) {
            $contacts[strtolower(trim($contact['email']))] = $contact['contactId'];
        }

        return $contacts;
    }

    /** @param array<string, string>|null $contacts */
    private function contactData(string $email, ?array $contacts): ?array
    {
        if ($contacts === null) {
            $data = $this->fairgate->findContactDataByEmail($email, ClientRegistrationLoginService::MEMBERSHIP)['data'] ?? null;
            return is_array($data) ? $data : null;
        }

        $contactId = $contacts[strtolower(trim($email))] ?? null;
        if ($contactId === null) {
            return null;
        }

        $data = $this->fairgate->findContactDataById($contactId)['data'] ?? null;
        return is_array($data) ? $data : null;
    }

    /** @param array<string, mixed> $order */
    private function sendConfirmation(array $order, string $email, array &$result): void
    {
        if (($order['fairgateStatus'] ?? null) === 'expired') {
            $order['fairgateDocumentEmail'] = $this->documentEmail();
        }
        $message = $this->emails->renderOrderConfirmation($order, 'definitive');
        try {
            $this->emails->sendStoredEmail($email, $message['subject'], $message['html'], $message['text']);
        } catch (Throwable $exception) {
            $this->queue->enqueue(
                $order['id'],
                'order_confirmation',
                $email,
                $message,
                $exception->getMessage(),
            );
            $this->log('Order confirmation failed and queued', $order['id'], $exception);
            $result['queued']++;
            return;
        }

        $this->orders->markBatchEmailSent($order['id']);
        $result['sent']++;
    }

    /** @param array<string, mixed> $order */
    private function processMissingFairgate(
        array $order,
        string $email,
        array &$result,
        string $status,
        ?DateTimeImmutable $reminderEndDate,
        DateTimeImmutable $now,
    ): void {
        if (!$this->reminderAllowed($reminderEndDate, $now)) {
            return;
        }
        $last = $order['fairgateReminderEmailSentAt'] ?? null;
        $reference = is_string($last) && trim($last) !== ''
            ? $last
            : ($order['createdAt'] ?? null);
        if (!is_string($reference) || trim($reference) === '') {
            return;
        }
        $interval = $this->intervalDays();
        $due = new DateTimeImmutable($reference, new DateTimeZone('UTC')) < new DateTimeImmutable('now', new DateTimeZone('UTC'))->modify('-' . $interval . ' days');
        if (!$due) {
            return;
        }
        $documentEmail = $status === 'expired' ? $this->documentEmail() : null;
        $message = $this->emails->renderFairgateReminder($this->fairgateUrl(), $status, $documentEmail);
        try {
            $this->emails->sendStoredEmail($email, $message['subject'], $message['html'], $message['text']);
            $this->orders->markFairgateReminderSent($order['id']);
            $result['sent']++;
        } catch (Throwable $exception) {
            $this->queue->enqueue($order['id'], 'fairgate_reminder', $email, $message, $exception->getMessage());
            $this->log('Fairgate reminder failed and queued', $order['id'], $exception);
            $result['queued']++;
        }
    }


    private function log(string $message, string $orderId, Throwable $exception): void
    {
        error_log(sprintf('%s: order=%s error=%s', $message, $orderId, $exception->getMessage()));
    }

    private function intervalDays(): int
    {
        $value = $this->config->findValueByVariableName(self::INTERVAL_CONFIG);
        if (!is_string($value) || !ctype_digit($value) || (int) $value < 1) {
            throw new \RuntimeException('Invalid Fairgate email interval configuration.');
        }
        return (int) $value;
    }

    private function reminderEndDate(): ?DateTimeImmutable
    {
        $value = $this->config->findValueByVariableName(self::REMINDER_END_DATE_CONFIG);
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $value = trim((string) $value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            throw new \RuntimeException('Invalid Fairgate reminder end date configuration.');
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
        $errors = DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            throw new \RuntimeException('Invalid Fairgate reminder end date configuration.');
        }
        return $date;
    }

    private function reminderAllowed(?DateTimeImmutable $endDate, DateTimeImmutable $now): bool
    {
        return $endDate === null || $now->format('Y-m-d') <= $endDate->format('Y-m-d');
    }

    private function fairgateUrl(): string
    {
        $value = $this->config->findValueByVariableName('fairgate_url');
        if (!is_string($value) || filter_var($value, FILTER_VALIDATE_URL) === false) {
            throw new \RuntimeException('Invalid Fairgate URL configuration.');
        }
        return $value;
    }

    private function documentEmail(): string
    {
        $value = $this->config->findValueByVariableName('fairgate_document_email');
        if (!is_string($value) || filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            throw new \RuntimeException('Invalid Fairgate document email configuration.');
        }
        return $value;
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
