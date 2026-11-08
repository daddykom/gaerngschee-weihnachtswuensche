<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Registration\Services\AnmeldungMailVariant;
use App\Shared\Mail\EmailSenderInterface;

final class RecordingEmailSender implements EmailSenderInterface
{
    /** @var list<string> */
    public array $recipients = [];
    /** @var list<AnmeldungMailVariant> */
    public array $variants = [];
    /** @var list<string|null> */
    public array $loginUrls = [];
    /** @var list<string> */
    public array $orderStatuses = [];
    public ?string $createdRecipient = null;
    public ?string $changedRecipient = null;
    /** @var list<array<string, mixed>> */
    public array $orderConfirmations = [];
    public bool $failOrderConfirmation = false;
    public bool $failStoredEmail = false;

    public function sendAnmeldung(string $recipient, AnmeldungMailVariant $variant, string $locale = 'de', ?string $loginUrl = null, ?array $wish = null): void
    {
        $this->recipients[] = $recipient;
        $this->variants[] = $variant;
        $this->loginUrls[] = $loginUrl;
    }

    public function renderFulfillerReservationConfirmation(array $wish, array $handover, string $locale = 'de'): array
    {
        return ['subject' => 'subject', 'html' => 'html', 'text' => 'text'];
    }

    public function sendOrderStatus(string $recipient, string $status, string $locale = 'de'): void
    {
        $this->recipients[] = $recipient;
        $this->orderStatuses[] = $status;
    }

    public function sendUserCreated(string $recipient, string $temporaryPassword): void
    {
        $this->createdRecipient = $recipient;
    }

    public function sendUserEmailChanged(string $recipient): void
    {
        $this->changedRecipient = $recipient;
    }

    public function sendPasswordReset(string $recipient, string $resetUrl): void
    {
        $this->recipients[] = $recipient;
    }

    public function sendOrderConfirmation(string $recipient, array $order): void
    {
        if ($this->failOrderConfirmation) {
            throw new \RuntimeException('SMTP failed');
        }

        $this->orderConfirmations[] = ['recipient' => $recipient, 'order' => $order];
    }

    public function renderOrderConfirmation(array $order, string $mailStatus): array
    {
        $order['renderedMailStatus'] = $mailStatus;
        return ['subject' => 'subject', 'html' => json_encode($order, JSON_THROW_ON_ERROR), 'text' => 'text'];
    }

    public function renderDeliveryNotification(array $order, string $deliveryUrl, string $qrDataUri): array
    {
        return ['subject' => 'delivery', 'html' => $qrDataUri . $deliveryUrl, 'text' => $deliveryUrl];
    }

    public function renderFairgateReminder(string $fairgateUrl, string $status = 'not_found', ?string $documentEmail = null): array
    {
        return ['subject' => 'Fairgate', 'html' => $fairgateUrl . ' Fairgate', 'text' => $fairgateUrl];
    }

    public function sendStoredEmail(string $recipient, string $subject, string $html, string $text): void
    {
        if ($this->failOrderConfirmation || $this->failStoredEmail) {
            throw new \RuntimeException('SMTP failed');
        }
        $this->orderConfirmations[] = ['recipient' => $recipient, 'order' => ['subject' => $subject, 'html' => $html, 'text' => $text]];
    }
}
