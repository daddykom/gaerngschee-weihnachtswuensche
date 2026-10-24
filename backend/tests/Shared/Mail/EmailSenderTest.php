<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Registration\Services\AnmeldungMailVariant;
use App\Shared\Mail\EmailSender;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class EmailSenderTest extends TestCase
{
    public function testSendAnmeldungRendersClientOrderVariant(): void
    {
        $variant = AnmeldungMailVariant::ClientOrder;
        $subject = 'Dein Link zur Weihnachtswünsche-Bestellung';
        $content = 'Jetzt für Weihnachtswünsche anmelden';
        $link = 'http://localhost:4200/login';
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email) use ($subject, $content, $link): bool {
                self::assertSame('person@example.com', $email->getTo()[0]->getAddress());
                self::assertSame($subject, $email->getSubject());
                self::assertStringContainsString($content, $email->getHtmlBody());
                self::assertStringContainsString($link, $email->getHtmlBody());
                self::assertStringContainsString('cid:gaerngschee-logo', $email->getHtmlBody());
                self::assertStringContainsString('gaerngschee-logo', $email->getBody()->toString());
                self::assertStringContainsString('#8a2858', $email->getHtmlBody());
                self::assertStringContainsString('#f5b6d3', $email->getHtmlBody());
                self::assertStringNotContainsString('#159447', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendAnmeldung('person@example.com', $variant);
    }

    public function testSendUserCreatedSendsTemporaryPasswordToNewUser(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('new@example.com', $email->getTo()[0]->getAddress());
                self::assertSame('Dein Benutzerkonto wurde erstellt', $email->getSubject());
                self::assertStringContainsString('temporary-secret', $email->getHtmlBody());
                self::assertStringContainsString('/login', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendUserCreated('new@example.com', 'temporary-secret');
    }

    public function testSendRegistrationLinkUsesTheSingleUseOrderUrl(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('Dein Link zur Weihnachtswünsche-Bestellung', $email->getSubject());
                self::assertStringContainsString('Weihnachtswünsche auswählen', $email->getHtmlBody());
                self::assertStringContainsString('http://localhost:4200/client-login?token=test-token', $email->getHtmlBody());
                self::assertStringContainsString('10 Minuten gültig', $email->getHtmlBody());
                self::assertStringContainsString('http://localhost:4200/client-login?token=test-token', $email->getTextBody());
                self::assertStringNotContainsString('fairgate.ch', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendAnmeldung(
            'person@example.com',
            AnmeldungMailVariant::ClientOrder,
            'de',
            'http://localhost:4200/client-login?token=test-token',
        );
    }

    public function testSendOrderConfirmationRendersDefinitiveOrder(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('client@example.com', $email->getTo()[0]->getAddress());
                self::assertSame('Deine Weihnachtswünsche-Anmeldung ist definitiv bestätigt', $email->getSubject());
                self::assertStringContainsString('definitiv bestätigt', $email->getHtmlBody());
                self::assertStringContainsString('Erwachsene: <strong>2</strong>', $email->getHtmlBody());
                self::assertStringContainsString('#f5b6d3', $email->getHtmlBody());
                self::assertStringContainsString('#dff4e8', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendOrderConfirmation('client@example.com', [
            'year' => 2026,
            'status' => 'definitive',
            'adultsCount' => 2,
            'childrenCount' => 0,
            'items' => [
                ['personType' => 'adult', 'category' => 'catA', 'quantity' => 2],
            ],
        ]);
    }

    public function testRenderFairgateReminderUsesSharedTranslations(): void
    {
        $sender = new EmailSender(
            $this->createMock(MailerInterface::class),
            'noreply@example.com',
            'Gärngschee-Weihnachtswünsche',
        );

        $message = $sender->renderFairgateReminder('https://fairgate.example/login');

        self::assertSame('Bitte schliesse deine Weihnachtswünsche-Anmeldung ab', $message['subject']);
        self::assertStringContainsString('Fairgate', $message['html']);
        self::assertStringContainsString('https://fairgate.example/login', $message['html']);
        self::assertStringContainsString('Fairgate anmelden', $message['text']);
    }

    public function testRenderExpiredFairgateReminderRequestsTheDocument(): void
    {
        $sender = new EmailSender(
            $this->createMock(MailerInterface::class),
            'noreply@example.com',
            'Gärngschee-Weihnachtswünsche',
        );

        $message = $sender->renderFairgateReminder('https://fairgate.example/login', 'expired', 'Info@gaerngschee.ch');

        self::assertStringContainsString('Bedürftigkeitsausweis', $message['html']);
        self::assertStringContainsString('Info@gaerngschee.ch', $message['html']);
        self::assertStringNotContainsString('Fairgate anmelden', $message['text']);
    }

    public function testRenderProvisionalOrderIncludesFairgateLink(): void
    {
        $sender = new EmailSender(
            $this->createMock(MailerInterface::class),
            'noreply@example.com',
            'Gärngschee-Weihnachtswünsche',
        );

        $message = $sender->renderOrderConfirmation([
            'year' => 2026,
            'status' => 'waiting_for_fairgate',
            'adultsCount' => 1,
            'childrenCount' => 0,
            'fairgateUrl' => 'https://fairgate.example/login',
            'items' => [
                ['personType' => 'adult', 'category' => 'catA', 'quantity' => 1],
            ],
        ], 'waiting_for_fairgate');

        self::assertStringContainsString('https://fairgate.example/login', $message['html']);
        self::assertStringContainsString('Weihnachtswünsche 2026', $message['html']);
        self::assertStringNotContainsString('{{ YEAR }}', $message['html']);
        self::assertStringContainsString('Zum Registrierungsformular', $message['text']);
    }

    public function testSendUserEmailChangedNotifiesNewAddress(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('new@example.com', $email->getTo()[0]->getAddress());
                self::assertSame('Deine E-Mail-Adresse wurde geändert', $email->getSubject());
                self::assertStringContainsString('neue Adresse', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendUserEmailChanged('new@example.com');
    }

}
