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
        $subject = 'Dein Link zum Weihnachtswünsche-Wunschzettel';
        $content = 'Jetzt für die Wunschzettel-Aktion anmelden';
        $link = 'http://localhost:4200/login';
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email) use ($subject, $content, $link): bool {
                self::assertSame('person@example.com', $email->getTo()[0]->getAddress());
                self::assertSame($subject, $email->getSubject());
                self::assertStringContainsString($content, $email->getHtmlBody());
                self::assertStringContainsString('Wunschzettel-Aktion 2027', $email->getHtmlBody());
                self::assertStringContainsString($link, $email->getHtmlBody());
                self::assertStringContainsString('cid:gaerngschee-logo', $email->getHtmlBody());
                self::assertStringContainsString('gaerngschee-logo', $email->getBody()->toString());
                self::assertStringContainsString('#8a2858', $email->getHtmlBody());
                self::assertStringContainsString('#f5b6d3', $email->getHtmlBody());
                self::assertStringNotContainsString('#159447', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendAnmeldung('person@example.com', $variant, 'de', null, null, 2027);
    }

    public function testSendTestEmailRendersFairgateRegistrationTranslation(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('Bitte zuerst bei Fairgate anmelden', $email->getSubject());
                self::assertStringContainsString('Zuerst bei Fairgate anmelden', $email->getHtmlBody());
                self::assertStringNotContainsString('app.mail.registration.fairgateRegistrationRequired', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendTestEmail('person@example.com', 'fairgate-registration-required', [
            'fairgateUrl' => 'https://fairgate.ch',
        ]);
    }

    public function testSendTestEmailRendersFairgateRegistrationAvailableTranslation(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('Du kannst jetzt Weihnachtswünsche anmelden', $email->getSubject());
                self::assertStringContainsString('Du kannst dich jetzt anmelden', $email->getHtmlBody());
                self::assertStringContainsString('Deine Fairgate-Anmeldung wurde gefunden.', $email->getHtmlBody());
                self::assertStringNotContainsString('app.mail.registration.fairgateRegistrationAvailable', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendTestEmail('person@example.com', 'fairgate-registration-available', [
            'startUrl' => 'https://example.com/start',
        ]);
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
                self::assertSame('Dein Link zum Weihnachtswünsche-Wunschzettel', $email->getSubject());
                self::assertStringContainsString('Weihnachtswünsche eintragen', $email->getHtmlBody());
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

    public function testSendFairgateRegistrationRequiredUsesTheFairgateUrlWithoutAClientLink(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('Bitte zuerst bei Fairgate anmelden', $email->getSubject());
                self::assertStringContainsString('https://fairgate.example/register', $email->getHtmlBody());
                self::assertStringContainsString('Bei Fairgate anmelden', $email->getTextBody());
                self::assertStringNotContainsString('/client-login', $email->getHtmlBody());
                self::assertStringNotContainsString('token=', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendAnmeldung(
            'person@example.com',
            AnmeldungMailVariant::FairgateRegistrationRequired,
            'de',
            'https://fairgate.example/register',
        );
    }

    public function testSendFairgateRegistrationAvailableUsesTheGenericStartUrl(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())
            ->method('send')
            ->with(self::callback(static function (Email $email): bool {
                self::assertSame('Du kannst jetzt Weihnachtswünsche anmelden', $email->getSubject());
                self::assertStringContainsString('http://localhost:4200/start', $email->getHtmlBody());
                self::assertStringContainsString('http://localhost:4200/start', $email->getTextBody());
                self::assertStringNotContainsString('/client-login', $email->getHtmlBody());
                self::assertStringNotContainsString('fairgate.example', $email->getHtmlBody());

                return true;
            }));

        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee-Weihnachtswünsche');

        $sender->sendAnmeldung(
            'person@example.com',
            AnmeldungMailVariant::FairgateRegistrationAvailable,
            'de',
            'http://localhost:4200/start',
        );
    }

    public function testRendersFulfillerReservationConfirmationWithoutAConfirmationLink(): void
    {
        $sender = new EmailSender(
            $this->createMock(MailerInterface::class),
            'noreply@example.com',
            'Gärngschee-Weihnachtswünsche',
        );

        $message = $sender->renderFulfillerReservationConfirmation(
            ['wishNumber' => '12-1', 'currentDescription' => 'Bauklötze'],
            ['date' => '2026-12-19', 'time' => '10:00–12:00 Uhr', 'location' => 'Clarastrasse 10, 4058 Basel'],
        );

        self::assertSame('Deine Wunschreservierung ist bestätigt', $message['subject']);
        self::assertStringContainsString('Bauklötze', $message['html']);
        self::assertStringContainsString('Clarastrasse 10, 4058 Basel', $message['html']);
        self::assertStringNotContainsString('http://localhost:4200', $message['html']);
        self::assertStringContainsString('Danke, dass du diesen Weihnachtswunsch erfüllst.', $message['text']);
    }

    public function testRendersSavedOrderMailWithLoginLink(): void
    {
        $sender = new EmailSender(
            $this->createMock(MailerInterface::class),
            'noreply@example.com',
            'Gärngschee-Weihnachtswünsche',
        );

        $message = $sender->renderOrderConfirmation([
            'year' => 2026,
            'loginUrl' => 'http://localhost:4200/login',
        ], 'saved');

        self::assertSame('Dein Wunschzettel wurde gespeichert', $message['subject']);
        self::assertStringContainsString('http://localhost:4200/login', $message['html']);
    }

    public function testRendersChangesRequestedMailWithoutAdminReason(): void
    {
        $sender = new EmailSender(
            $this->createMock(MailerInterface::class),
            'noreply@example.com',
            'Gärngschee-Weihnachtswünsche',
        );

        $message = $sender->renderOrderConfirmation([
            'year' => 2026,
            'loginUrl' => 'http://localhost:4200/login',
        ], 'changes_requested');

        self::assertSame('Bitte passe deinen Wunschzettel an', $message['subject']);
        self::assertStringContainsString('Wunschzettel wurde zurückgewiesen', $message['html']);
        self::assertStringContainsString('border:1px solid #8c7b85; border-radius:20px;', $message['html']);
        self::assertStringContainsString('http://localhost:4200/login', $message['text']);
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
