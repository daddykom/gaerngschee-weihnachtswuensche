<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\FulfillerReminderRepository;
use App\Shared\Mail\EmailSenderInterface;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

final class FulfillerReminderService
{
    public function __construct(
        private readonly FrontendConfigRepository $config,
        private readonly FulfillerReminderRepository $reminders,
        private readonly EmailSenderInterface $emails,
    ) {
    }

    /** @return array{sent: int, failed: int} */
    public function run(?DateTimeImmutable $now = null): array
    {
        $today = ($now ?? new DateTimeImmutable())->setTimezone(new DateTimeZone('Europe/Zurich'))->format('Y-m-d');
        $result = ['sent' => 0, 'failed' => 0];
        $dates = $this->config->findValueByVariableName('fulfiller_reminder_dates');
        if (!is_string($dates) || !in_array($today, array_map('trim', preg_split('/\R/', $dates) ?: []), true)) {
            return $result;
        }

        $handover = [];
        foreach (['date', 'time', 'location'] as $key) {
            $value = $this->config->findValueByVariableName('fulfiller_handover_' . $key);
            $handover[$key] = is_string($value) ? $value : '';
        }
        foreach ($this->reminders->findOutstandingWishes($this->config->findCampaignYear()) as $recipient => $wishes) {
            try {
                $sent = $this->reminders->deliverOnce($recipient, $today, function () use ($recipient, $wishes, $handover): void {
                    $message = $this->emails->renderFulfillerReminder($wishes, $handover);
                    $this->emails->sendStoredEmail($recipient, $message['subject'], $message['html'], $message['text']);
                });
                $result['sent'] += $sent ? 1 : 0;
            } catch (Throwable $exception) {
                error_log('Fulfiller reminder delivery failed: ' . $exception->getMessage());
                $result['failed']++;
            }
        }
        return $result;
    }
}
