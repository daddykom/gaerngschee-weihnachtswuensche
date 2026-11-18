<?php

declare(strict_types=1);

namespace App\Shared\Mail;

use App\Configuration\Data\FrontendConfigRepository;
use App\Shared\Database\Database;
use App\Registration\Services\AnmeldungMailVariant;
use App\Registration\Services\PickupCodeService;
use App\Registration\Services\QrCodeGenerator;
use App\Shared\Logging\ExternalErrorLogger;
use App\Shared\Translation\SharedJsonFileLoader;
use Symfony\Bridge\Twig\Extension\TranslationExtension;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Part\DataPart;
use Symfony\Component\Translation\Loader\ArrayLoader;
use Symfony\Component\Translation\Translator;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;

final class EmailSender implements EmailSenderInterface
{
    private const LOGO_CID = 'gaerngschee-logo';
    private const PICKUP_QR_CID = 'pickup-qr-code';
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
        private readonly ?FrontendConfigRepository $frontendConfig = null,
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

    /** @param list<array<string, string>> $wishes @param array<string, string> $handover */
    public function renderFulfillerReminder(array $wishes, array $handover, string $locale = 'de'): array
    {
        if ($this->translator instanceof LocaleAwareInterface) {
            $this->translator->setLocale($locale);
        }
        $html = $this->twig->render('fulfiller-reminder.html.twig', [
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
            'WISHES' => $wishes,
            'HANDOVER' => $handover,
        ]);
        return [
            'subject' => $this->translator->trans('app.mail.registration.fulfillerReminder.subject', [], null, $locale),
            'html' => $html,
            'text' => $this->plainText($html, true),
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
        if (!in_array($mailStatus, ['saved', 'changes_requested', 'definitive'], true)) {
            throw new \InvalidArgumentException('Invalid order confirmation mail status.');
        }
        $pickupDetails = [];
        if ($mailStatus === 'definitive') {
            if ($this->translator instanceof LocaleAwareInterface) {
                $this->translator->setLocale('de');
            }
            $config = $this->frontendConfig ?? new FrontendConfigRepository(Database::getConnection());
            $date = $order['pickupDate'] ?? $config->findValueByVariableName('pickup_date');
            $location = $order['pickupLocation'] ?? $config->findValueByVariableName('pickup_location');
            if (!is_string($date) || trim($date) === '' || !is_string($location) || trim($location) === '') {
                throw new \RuntimeException('Pickup date and location must be configured before sending acceptance notifications.');
            }
            $pickupDetails = ['PICKUP_DATE' => $date, 'PICKUP_LOCATION' => $location];
        }
        $html = $this->twig->render('order-confirmation-' . $mailStatus . '.html.twig', [
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
            'ORDER' => $order,
            ...$pickupDetails,
        ]);
        $subject = $this->translator->trans('app.mail.order.confirmation.' . $mailStatus . '.subject', [], null, 'de');

        return ['subject' => $subject, 'html' => $html, 'text' => $this->plainText($html, $mailStatus === 'definitive')];
    }

    public function sendStoredEmail(string $recipient, string $subject, string $html, string $text): void
    {
        $this->sendUserEmail($recipient, $subject, $html, $text);
    }

    /** @param array{year: int, orderNumber: int, pickupDate?: string, pickupLocation?: string} $order @return array{subject: string, html: string, text: string} */
    public function renderPickupNotification(array $order, string $token): array
    {
        if ($this->translator instanceof LocaleAwareInterface) {
            $this->translator->setLocale('de');
        }
        if ($order['year'] < 1 || $order['orderNumber'] < 1) {
            throw new \InvalidArgumentException('Invalid pickup order data.');
        }
        $code = (new PickupCodeService())->forToken($token);
        $config = $this->frontendConfig ?? new FrontendConfigRepository(Database::getConnection());
        $pickupDate = $order['pickupDate'] ?? $config->findValueByVariableName('pickup_date');
        $pickupLocation = $order['pickupLocation'] ?? $config->findValueByVariableName('pickup_location');
        $html = $this->twig->render('order-ready-for-pickup.html.twig', [
            'ORDER' => $order,
            'PICKUP_DATE' => is_string($pickupDate) ? $pickupDate : '',
            'PICKUP_LOCATION' => is_string($pickupLocation) ? $pickupLocation : '',
            'QR_DATA_URI' => (new QrCodeGenerator())->generateDataUri($code['pickupUrl']),
            'QR_IMAGE_URL' => $code['imageUrl'],
            'LOGO_CID' => 'cid:' . self::LOGO_CID,
        ]);

        return [
            'subject' => $this->translator->trans('app.mail.pickup.subject', [], null, 'de'),
            'html' => $html,
            'text' => $this->plainText($html, true),
        ];
    }

    /** @param array<string, mixed> $parameters */
    public function sendTestEmail(string $recipient, string $template, array $parameters): void
    {
        $message = match ($template) {
            'client-order' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::ClientOrder, (string) $parameters['loginUrl'], null, (int) $parameters['campaignYear']),
            'fulfiller-reservation' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::FulfillerReservation, (string) $parameters['loginUrl'], [
                'wishNumber' => (string) $parameters['wishNumber'],
                'title' => (string) $parameters['wishTitle'],
                'currentDescription' => (string) $parameters['wishDescription'],
            ]),
            'fulfiller-reminder' => $this->renderFulfillerReminder([[
                'wishNumber' => (string) $parameters['wishNumber'],
                'title' => (string) $parameters['wishTitle'],
                'currentDescription' => (string) $parameters['wishDescription'],
            ]], [
                'date' => (string) $parameters['handoverDate'],
                'time' => (string) $parameters['handoverTime'],
                'location' => (string) $parameters['handoverLocation'],
            ]),
            'fairgate-registration-required' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::FairgateRegistrationRequired, (string) $parameters['fairgateUrl']),
            'fairgate-registration-available' => $this->renderAnmeldungTest($recipient, AnmeldungMailVariant::FairgateRegistrationAvailable, (string) $parameters['startUrl']),
            'user-created' => $this->renderUserCreatedTest((string) $parameters['loginUrl'], (string) $parameters['temporaryPassword']),
            'user-email-changed' => $this->renderUserEmailChangedTest((string) $parameters['loginUrl']),
            'password-reset' => $this->renderPasswordResetTest((string) $parameters['resetUrl']),
            'order-ready-for-pickup' => $this->renderPickupNotification([
                'year' => (int) $parameters['year'],
                'orderNumber' => (int) $parameters['orderNumber'],
                ...array_filter([
                    'pickupDate' => (string) ($parameters['pickupDate'] ?? ''),
                    'pickupLocation' => (string) ($parameters['pickupLocation'] ?? ''),
                ], static fn (string $value): bool => trim($value) !== ''),
            ], (new PickupCodeService())->create()['token']),
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
        if ($status === 'definitive') {
            foreach (['pickupDate', 'pickupLocation'] as $key) {
                if (trim((string) ($order[$key] ?? '')) === '') {
                    unset($order[$key]);
                }
            }
        }
        if ($status === 'changes_requested') {
            $order['adminNotes'] = (string) ($parameters['orderFeedback'] ?? '');
            $order['items'] = [[
                'publicationStatus' => 'rejected',
                'wishNumber' => (string) ($parameters['wishNumber'] ?? ''),
                'currentTitle' => (string) ($parameters['wishTitle'] ?? ''),
                'adminNotes' => (string) ($parameters['wishFeedback'] ?? ''),
            ]];
        }
        return $this->renderOrderConfirmation($order, $status);
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

        // Keep the PNG in stored HTML so retries do not depend on files or external image downloads.
        if (preg_match('/<img\s+id="pickup-qr-code"\s+src="data:image\/png;base64,([A-Za-z0-9+\/=]+)"/', $html, $qr) === 1) {
            $png = base64_decode($qr[1], true);
            if ($png === false || !str_starts_with($png, "\x89PNG\r\n\x1a\n")) {
                throw new \InvalidArgumentException('Invalid stored pickup QR image.');
            }
            $message->addPart((new DataPart($png, self::PICKUP_QR_CID, 'image/png'))->asInline());
            $message->html(str_replace('data:image/png;base64,' . $qr[1], 'cid:' . self::PICKUP_QR_CID, $html));
        }

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

    private function plainText(string $html, bool $preserveLineBreaks = false): string
    {
        $html = (string) preg_replace_callback(
            '/<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is',
            static fn (array $match): string => $match[2] . ' (' . $match[1] . ')',
            $html,
        );

        if ($preserveLineBreaks) {
            $html = (string) preg_replace('/\s+/', ' ', $html);
            $html = (string) preg_replace('/<br\s*\/?\s*>|<\/p>/i', "\n", $html);
            return trim(implode("\n", array_map('trim', explode("\n", html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8')))));
        }

        return trim((string) preg_replace(
            '/\s+/',
            ' ',
            html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        ));
    }

}
