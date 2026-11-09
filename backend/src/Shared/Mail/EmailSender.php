<?php

declare(strict_types=1);

namespace App\Shared\Mail;

use App\Registration\Services\AnmeldungMailVariant;
use App\Shared\Logging\ExternalErrorLogger;
use App\Shared\Translation\SharedJsonFileLoader;
use Symfony\Bridge\Twig\Extension\TranslationExtension;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Translation\Loader\ArrayLoader;
use Symfony\Component\Translation\Translator;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;

final class EmailSender implements EmailSenderInterface
{
    private const LOGO_CID = 'gaerngschee-logo';
    private const EMAIL_THEME = [
        'pageBackground' => '#fff7fb',
        'surface' => '#fff8fc',
        'primaryContainer' => '#f5b6d3',
        'primary' => '#8a2858',
        'onPrimary' => '#ffffff',
        'successContainer' => '#dff4e8',
        'success' => '#276749',
        'warningContainer' => '#fff2b7',
        'warning' => '#6b5700',
        'infoContainer' => '#d8e9f7',
        'info' => '#2c5d78',
        'errorContainer' => '#ffdad6',
        'error' => '#b3261e',
        'text' => '#000000',
        'mutedText' => '#6f6069',
        'outline' => '#8c7b85',
    ];

    private readonly MailerInterface $mailer;
    private readonly string $fromAddress;
    private readonly string $fromName;
    private readonly Environment $twig;
    private readonly TranslatorInterface $translator;

    public function __construct(
        ?MailerInterface $mailer = null,
        ?string $fromAddress = null,
        ?string $fromName = null,
        ?string $mailerDsn = null,
        ?Environment $twig = null,
        ?TranslatorInterface $translator = null,
    ) {
        $configuration = $mailer === null || $fromAddress === null || $fromName === null
            ? MailConfiguration::load()
            : null;
        $this->mailer = $mailer ?? new Mailer(Transport::fromDsn(
            $mailerDsn ?? $configuration['mailer_dsn'],
        ));
        $this->fromAddress = $fromAddress ?? $configuration['from_address'];
        $this->fromName = $fromName ?? $configuration['from_name'];
        $this->twig = $twig ?? new Environment(
            new FilesystemLoader([
                dirname(__DIR__, 3) . '/resources/emails/anmeldung',
                dirname(__DIR__, 3) . '/resources/emails',
            ]),
        );
        $this->translator = $translator ?? $this->createTranslator();
        $this->twig->addExtension(new TranslationExtension($this->translator));
        $this->twig->addGlobal('EMAIL_THEME', self::EMAIL_THEME);
    }

    public function sendAnmeldung(
        string $recipient,
        AnmeldungMailVariant $variant,
        string $locale = 'de',
        ?string $loginUrl = null,
        ?array $wish = null,
        ?int $campaignYear = null,
    ): void {
        if ($this->translator instanceof LocaleAwareInterface) {
            $this->translator->setLocale($locale);
        }
        $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
        $html = $this->twig->render($variant->value . '.html.twig', [
            'LOGIN_URL' => $loginUrl ?? $frontendBaseUrl . '/login',
            'LOGO_CID' => 'cid:gaerngschee-logo',
            'REGISTRATION_URL' => $frontendBaseUrl . '/register',
            'FAIRGATE_URL' => getenv('FAIRGATE_URL') ?: 'https://www.fairgate.ch',
            'WISH' => $wish,
            'CAMPAIGN_YEAR' => $campaignYear ?? (int) date('Y'),
        ]);

        $subjectKey = match ($variant) {
            AnmeldungMailVariant::ClientOrder => 'app.mail.registration.clientOrder.subject',
            AnmeldungMailVariant::FulfillerReservation => 'app.mail.registration.fulfillerReservation.subject',
            AnmeldungMailVariant::FairgateRegistrationRequired => 'app.mail.registration.fairgateRegistrationRequired.subject',
            AnmeldungMailVariant::FairgateRegistrationAvailable => 'app.mail.registration.fairgateRegistrationAvailable.subject',
        };
        $message = (new Email())
            ->from(new Address($this->fromAddress, $this->fromName))
            ->to($recipient)
            ->subject($this->translator->trans($subjectKey, [], null, $locale))
            ->text($this->plainText($html))
            ->html($html)
            ->embedFromPath(
                dirname(__DIR__, 3) . '/resources/pictures/gaerngschee-logo.png',
                'gaerngschee-logo',
                'image/png',
            );

        try {
            $this->mailer->send($message);
        } catch (TransportExceptionInterface $exception) {
            ExternalErrorLogger::log('email', 'registration_email', $exception->getMessage());
            throw new EmailDeliveryException(
                'The email could not be sent: ' . $exception->getMessage(),
                0,
                $exception,
            );
        }
    }

    /** @param array<string, mixed> $wish @param array<string, mixed> $handover */
    public function renderFulfillerReservationConfirmation(
        array $wish,
        array $handover,
        string $locale = 'de',
    ): array {
        if ($this->translator instanceof LocaleAwareInterface) {
            $this->translator->setLocale($locale);
        }
        $html = $this->twig->render('fulfiller-reservation-confirmation.html.twig', [
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
            'WISH' => $wish,
            'HANDOVER' => $handover,
        ]);

        return [
            'subject' => $this->translator->trans(
                'app.mail.registration.fulfillerReservationConfirmation.subject',
                [],
                null,
                $locale,
            ),
            'html' => $html,
            'text' => $this->plainText($html),
        ];
    }

    public function sendUserCreated(string $recipient, string $temporaryPassword): void
    {
        $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
        $html = $this->twig->render('user-created.html.twig', [
            'LOGIN_URL' => $frontendBaseUrl . '/login',
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
            'TEMPORARY_PASSWORD' => $temporaryPassword,
        ]);

        $this->sendUserEmail($recipient, $this->translator->trans('app.mail.user.created.subject'), $html);
    }

    public function sendUserEmailChanged(string $recipient): void
    {
        $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
        $html = $this->twig->render('user-email-changed.html.twig', [
            'LOGIN_URL' => $frontendBaseUrl . '/login',
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
        ]);

        $this->sendUserEmail($recipient, $this->translator->trans('app.mail.user.emailChanged.subject'), $html);
    }

    public function sendPasswordReset(string $recipient, string $resetUrl): void
    {
        $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
        $html = $this->twig->render('password-reset.html.twig', [
            'LOGIN_URL' => $frontendBaseUrl . '/login',
            'RESET_URL' => $resetUrl,
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
        ]);

        $this->sendUserEmail($recipient, $this->translator->trans('app.mail.passwordReset.subject'), $html);
    }

    /** @param array<string, mixed> $order */
    public function sendOrderConfirmation(string $recipient, array $order): void
    {
        $message = $this->renderOrderConfirmation($order, (string) $order['status']);
        $this->sendStoredEmail($recipient, $message['subject'], $message['html'], $message['text']);
    }

    /** @return array{subject: string, html: string, text: string} */
    public function renderOrderConfirmation(array $order, string $mailStatus): array
    {
        if (!in_array($mailStatus, ['saved', 'released', 'waiting_for_fairgate', 'family_size_exceeded', 'changes_requested', 'definitive'], true)) {
            throw new \InvalidArgumentException('Invalid order confirmation mail status.');
        }
        $html = $this->twig->render('order-confirmation-' . $mailStatus . '.html.twig', [
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
            'ORDER' => $order,
        ]);
        $subject = $this->translator->trans('app.mail.order.confirmation.' . $mailStatus . '.subject', [], null, 'de');

        return ['subject' => $subject, 'html' => $html, 'text' => $this->plainText($html)];
    }

    /** @return array{subject: string, html: string, text: string} */
    public function renderFairgateReminder(string $fairgateUrl, string $status = 'not_found', ?string $documentEmail = null): array
    {
        $html = $this->twig->render('fairgate-reminder.html.twig', [
            'FAIRGATE_URL' => $fairgateUrl,
            'FAIRGATE_STATUS' => $status,
            'DOCUMENT_EMAIL' => $documentEmail,
        ]);

        return [
            'subject' => $this->translator->trans('app.mail.fairgateReminder.subject'),
            'html' => $html,
            'text' => $this->plainText($html),
        ];
    }

    public function sendStoredEmail(string $recipient, string $subject, string $html, string $text): void
    {
        $this->sendUserEmail($recipient, $subject, $html, $text);
    }

    /** @param array<string, mixed> $parameters */
    public function sendTestEmail(string $recipient, string $template, array $parameters): void
    {
        $message = match ($template) {
            'client-order' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::ClientOrder, (string) $parameters['loginUrl'], null, (int) $parameters['campaignYear']),
            'fulfiller-reservation' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::FulfillerReservation, (string) $parameters['loginUrl'], [
                'wishNumber' => (string) $parameters['wishNumber'],
                'currentDescription' => (string) $parameters['wishDescription'],
            ]),
            'fairgate-registration-required' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::FairgateRegistrationRequired, (string) $parameters['fairgateUrl']),
            'fairgate-registration-available' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::FairgateRegistrationAvailable, (string) $parameters['startUrl']),
            'user-created' => $this->renderUserCreatedTest((string) $parameters['loginUrl'], (string) $parameters['temporaryPassword']),
            'user-email-changed' => $this->renderUserEmailChangedTest((string) $parameters['loginUrl']),
            'password-reset' => $this->renderPasswordResetTest((string) $parameters['resetUrl']),
            'fairgate-reminder' => $this->renderFairgateReminder((string) $parameters['fairgateUrl'], (string) $parameters['status'], $this->optionalString($parameters['documentEmail'] ?? null)),
            default => $this->renderOrderTest($template, $parameters),
        };

        $this->sendStoredEmail($recipient, $message['subject'], $message['html'], $message['text']);
    }

    /** @return array{subject: string, html: string, text: string} */
    private function renderAnmeldungTest(string $recipient, AnmeldungMailVariant $variant, string $loginUrl, ?array $wish = null, ?int $campaignYear = null): array
    {
        if ($this->translator instanceof LocaleAwareInterface) {
            $this->translator->setLocale('de');
        }
        $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
        $html = $this->twig->render($variant->value . '.html.twig', [
            'LOGIN_URL' => $loginUrl,
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
            'REGISTRATION_URL' => $frontendBaseUrl . '/register',
            'FAIRGATE_URL' => getenv('FAIRGATE_URL') ?: 'https://www.fairgate.ch',
            'WISH' => $wish,
            'CAMPAIGN_YEAR' => $campaignYear ?? (int) date('Y'),
        ]);
        $subjectKey = match ($variant) {
            AnmeldungMailVariant::ClientOrder => 'app.mail.registration.clientOrder.subject',
            AnmeldungMailVariant::FulfillerReservation => 'app.mail.registration.fulfillerReservation.subject',
            AnmeldungMailVariant::FairgateRegistrationRequired => 'app.mail.registration.fairgateRegistrationRequired.subject',
            AnmeldungMailVariant::FairgateRegistrationAvailable => 'app.mail.registration.fairgateRegistrationAvailable.subject',
        };

        return ['subject' => $this->translator->trans($subjectKey, [], null, 'de'), 'html' => $html, 'text' => $this->plainText($html)];
    }

    /** @return array{subject: string, html: string, text: string} */
    private function renderUserCreatedTest(string $loginUrl, string $temporaryPassword): array
    {
        return $this->renderSimpleTest('user-created.html.twig', 'app.mail.user.created.subject', ['LOGIN_URL' => $loginUrl, 'TEMPORARY_PASSWORD' => $temporaryPassword]);
    }

    /** @return array{subject: string, html: string, text: string} */
    private function renderUserEmailChangedTest(string $loginUrl): array
    {
        return $this->renderSimpleTest('user-email-changed.html.twig', 'app.mail.user.emailChanged.subject', ['LOGIN_URL' => $loginUrl]);
    }

    /** @return array{subject: string, html: string, text: string} */
    private function renderPasswordResetTest(string $resetUrl): array
    {
        return $this->renderSimpleTest('password-reset.html.twig', 'app.mail.passwordReset.subject', ['RESET_URL' => $resetUrl]);
    }

    /** @param array<string, mixed> $variables @return array{subject: string, html: string, text: string} */
    private function renderSimpleTest(string $template, string $subjectKey, array $variables): array
    {
        $html = $this->twig->render($template, [...$variables, 'LOGO_CID' => 'cid:' . self::LOGO_CID]);
        return ['subject' => $this->translator->trans($subjectKey), 'html' => $html, 'text' => $this->plainText($html)];
    }

    /** @param array<string, mixed> $parameters @return array{subject: string, html: string, text: string} */
    private function renderOrderTest(string $template, array $parameters): array
    {
        $status = str_starts_with($template, 'order-confirmation-') ? substr($template, strlen('order-confirmation-')) : '';
        $order = $parameters;
        $order['status'] = $status;
        return $this->renderOrderConfirmation($order, $status);
    }

    private function optionalString(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    private function sendUserEmail(string $recipient, string $subject, string $html, ?string $text = null): void
    {
        $message = (new Email())
            ->from(new Address($this->fromAddress, $this->fromName))
            ->to($recipient)
            ->subject($subject)
            ->text($text ?? $this->plainText($html))
            ->html($html)
            ->embedFromPath(
                dirname(__DIR__, 3) . '/resources/pictures/gaerngschee-logo.png',
                self::LOGO_CID,
                'image/png',
            );

        try {
            $this->mailer->send($message);
        } catch (TransportExceptionInterface $exception) {
            ExternalErrorLogger::log('email', 'smtp_send', $exception->getMessage());
            throw new EmailDeliveryException(
                'The email could not be sent: ' . $exception->getMessage(),
                0,
                $exception,
            );
        }
    }

    private function createTranslator(): TranslatorInterface
    {
        $translator = new Translator(getenv('APP_LOCALE') ?: 'de');
        $translator->addLoader('array', new ArrayLoader());
        $translator->addLoader('json', new SharedJsonFileLoader());
        $translator->addResource(
            'json',
            $this->translationPath(),
            'de',
        );

        return $translator;
    }

    private function translationPath(): string
    {
        $configuredPath = getenv('SHARED_TRANSLATIONS_PATH');
        $paths = [
            is_string($configuredPath) && trim($configuredPath) !== '' ? $configuredPath : null,
            dirname(__DIR__, 4) . '/frontend/public/i18n/de.json',
            dirname(__DIR__, 4) . '/frontend/i18n/de.json',
            '/var/www/shared/i18n/de.json',
        ];

        foreach ($paths as $path) {
            if (is_string($path) && is_file($path)) {
                return $path;
            }
        }

        throw new \RuntimeException('Shared German translation file could not be found.');
    }

    private function plainText(string $html): string
    {
        $html = (string) preg_replace_callback(
            '/<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is',
            static fn (array $match): string => $match[2] . ' (' . $match[1] . ')',
            $html,
        );

        return trim((string) preg_replace(
            '/\s+/',
            ' ',
            html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        ));
    }

}
