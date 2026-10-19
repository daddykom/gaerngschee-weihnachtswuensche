<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Shared\Mail\EmailSenderInterface;
use InvalidArgumentException;

final class AnmeldungService
{
    public function __construct(
        private readonly EmailSenderInterface $emailSender,
    ) {
    }

    public function sendRegistrationLink(string $email, string $loginUrl, string $locale = 'de'): void
    {
        $email = strtolower(trim($email));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Invalid email address.');
        }

        $this->emailSender->sendAnmeldung($email, AnmeldungMailVariant::ClientOrder, $locale, $loginUrl);
    }

}
