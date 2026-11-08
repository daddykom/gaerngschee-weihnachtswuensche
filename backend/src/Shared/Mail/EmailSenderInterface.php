<?php

declare(strict_types=1);

namespace App\Shared\Mail;

use App\Registration\Services\AnmeldungMailVariant;

interface EmailSenderInterface
{
    public function sendAnmeldung(
        string $recipient,
        AnmeldungMailVariant $variant,
        string $locale = 'de',
        ?string $loginUrl = null,
        ?array $wish = null,
    ): void;

    /** @param array<string, mixed> $wish @param array<string, mixed> $handover */
    public function renderFulfillerReservationConfirmation(
        array $wish,
        array $handover,
        string $locale = 'de',
    ): array;

    public function sendUserCreated(string $recipient, string $temporaryPassword): void;

    public function sendUserEmailChanged(string $recipient): void;

    public function sendPasswordReset(string $recipient, string $resetUrl): void;

    /** @param array<string, mixed> $order */
    public function sendOrderConfirmation(string $recipient, array $order): void;

    /** @param array<string, mixed> $order */
    public function renderOrderConfirmation(array $order, string $mailStatus): array;

    /** @return array{subject: string, html: string, text: string} */
    public function renderFairgateReminder(string $fairgateUrl, string $status = 'not_found', ?string $documentEmail = null): array;

    public function sendStoredEmail(string $recipient, string $subject, string $html, string $text): void;
}
