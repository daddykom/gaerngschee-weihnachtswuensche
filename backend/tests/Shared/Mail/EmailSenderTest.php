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
    public function testReviewEmailContainsOnlyRelevantFeedbackAndEditedWishTitlesInBothFormats(): void
    {
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee');
        $message = $sender->renderOrderConfirmation([
            'year' => 2026,
            'loginUrl' => 'https://example.com/login',
            'orderNumber' => 12,
            'originalText' => 'Private original family text',
            'currentText' => 'Full current family text',
            'adminNotes' => "Review <b>the family text</b>.\nPlease check the details.",
            'items' => [
                ['publicationStatus' => 'approved', 'adminNotes' => 'Old approved feedback', 'currentTitle' => 'Approved title'],
                [
                    'publicationStatus' => 'rejected', 'itemNumber' => 3,
                    'originalTitle' => 'Private original title', 'currentTitle' => 'Edited coat title',
                    'currentDescription' => 'Full current wish description',
                    'adminNotes' => "Review <script>the size</script>.\nPlease check the colour.",
                ],
                ['publicationStatus' => 'rejected', 'adminNotes' => '   ', 'currentTitle' => 'Empty feedback title'],
                ['publicationStatus' => 'rejected', 'itemNumber' => 5, 'currentTitle' => 'Edited shoe title', 'adminNotes' => 'Check the shoe size'],
            ],
        ], 'changes_requested');

        self::assertSame('Bitte prüfe deinen Wunschzettel', $message['subject']);
        foreach ([$message['html'], $message['text']] as $body) {
            foreach (['2026', '12-3', '12-5', 'Edited coat title', 'Edited shoe title', 'Please check the details.', 'Please check the colour.', 'Check the shoe size', 'https://example.com/login'] as $expected) {
                self::assertStringContainsString($expected, $body);
            }
            foreach (['Old approved feedback', 'Approved title', 'Empty feedback title', 'Private original', 'Full current family text', 'Full current wish description', 'app.mail.'] as $excluded) {
                self::assertStringNotContainsString($excluded, $body);
            }
        }
        self::assertStringContainsString('Review &lt;b&gt;the family text&lt;/b&gt;.<br />', $message['html']);
        self::assertStringContainsString('Review &lt;script&gt;the size&lt;/script&gt;.<br />', $message['html']);
        self::assertStringNotContainsString('<script>', $message['html']);
        self::assertStringContainsString('Review <b>the family text</b>. Please check the details.', $message['text']);
        self::assertStringContainsString('Wunschzettel prüfen (https://example.com/login)', $message['text']);
    }

    public function testReviewEmailUsesTheWishPositionWhenNoNumbersHaveBeenAssigned(): void
    {
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee');
        $message = $sender->renderOrderConfirmation([
            'year' => 2026, 'loginUrl' => 'https://example.com/login',
            'items' => [
                ['status' => 'approved', 'adminNotes' => 'Old feedback'],
                ['status' => 'rejected', 'currentTitle' => 'Second wish', 'adminNotes' => 'Please review this wish'],
            ],
        ], 'changes_requested');

        foreach ([$message['html'], $message['text']] as $body) {
            self::assertStringContainsString('Rückmeldung zu Wunsch 2', $body);
            self::assertStringContainsString('Second wish', $body);
            self::assertStringNotContainsString('Old feedback', $body);
            self::assertStringNotContainsString('Rückmeldung zu deinem Wunschzettel', $body);
        }
    }

    public function testReviewEmailOmitsEmptyFeedbackSections(): void
    {
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee');
        foreach ([[], ['adminNotes' => null], ['adminNotes' => '   ', 'items' => [['publicationStatus' => 'rejected', 'adminNotes' => null]]]] as $feedback) {
            $message = $sender->renderOrderConfirmation([
                'year' => 2026, 'loginUrl' => 'https://example.com/login', ...$feedback,
            ], 'changes_requested');
            foreach ([$message['html'], $message['text']] as $body) {
                self::assertStringNotContainsString('Rückmeldung zu', $body);
                self::assertStringContainsString('erneut ein', $body);
                self::assertStringContainsString('https://example.com/login', $body);
            }
        }
    }

    public function testReviewTestEmailIncludesTheConfiguredOrderAndWishFeedback(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            foreach ([$email->getHtmlBody(), $email->getTextBody()] as $body) {
                foreach (['Test family feedback', '12-3', 'Test edited title', 'Test wish feedback'] as $expected) {
                    self::assertStringContainsString($expected, $body);
                }
            }
            return true;
        }));
        (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee'))->sendTestEmail('test@example.com', 'order-confirmation-changes_requested', [
            'year' => '2026', 'loginUrl' => 'https://example.com/login',
            'orderFeedback' => 'Test family feedback', 'wishNumber' => '12-3',
            'wishTitle' => 'Test edited title', 'wishFeedback' => 'Test wish feedback',
        ]);
    }

    public function testReservationMailUsesTheEditedTitleAndDescriptionInHtmlAndPlainText(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            foreach ([$email->getHtmlBody(), $email->getTextBody()] as $body) {
                self::assertStringContainsString('Wie schön, dass du diesen Wunsch erfüllst, bitte bestätige das auf folgendem Link:', $body);
                self::assertStringContainsString('Wunschnummer 12-1 Edited wish title', $body);
                self::assertStringContainsString('Wunscherfüllung bestätigen', $body);
                self::assertStringContainsString('https://example.com/confirm', $body);
                self::assertStringNotContainsString('Bitte bestätige, dass du den folgenden Wunsch erfüllen möchtest:', $body);
                self::assertStringContainsString('Edited wish title', $body);
                self::assertStringContainsString('Edited wish description', $body);
                self::assertStringNotContainsString('Private original', $body);
                self::assertStringNotContainsString('Private team message', $body);
            }
            self::assertStringContainsString('<strong>Wunschnummer 12-1 Edited wish title</strong>', $email->getHtmlBody());
            return true;
        }));
        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee');
        $sender->sendAnmeldung('person@example.com', AnmeldungMailVariant::FulfillerReservation, 'de', 'https://example.com/confirm', [
            'wishNumber' => '12-1', 'title' => 'Edited wish title', 'currentDescription' => 'Edited wish description',
            'originalTitle' => 'Private original title', 'originalDescription' => 'Private original description',
            'personalMessage' => 'Private team message',
        ]);
    }

    public function testReservationTestMailIncludesTheConfiguredWishTitle(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            foreach ([$email->getHtmlBody(), $email->getTextBody()] as $body) {
                self::assertStringContainsString('Wunschnummer 12-1 Edited test title', $body);
                self::assertStringContainsString('Wunscherfüllung bestätigen', $body);
            }
            return true;
        }));
        (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee'))->sendTestEmail('test@example.com', 'fulfiller-reservation', [
            'loginUrl' => 'https://example.com/confirm', 'wishNumber' => '12-1',
            'wishTitle' => 'Edited test title', 'wishDescription' => 'Edited description',
        ]);
    }

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
            ['date' => '17.–19. Dezember 2026', 'time' => '10:00–12:00 Uhr', 'location' => 'Clarastrasse 10, 4058 Basel'],
        );

        self::assertSame('Deine Wunschreservierung ist bestätigt', $message['subject']);
        self::assertStringContainsString('Bauklötze', $message['html']);
        self::assertStringContainsString('17.–19. Dezember 2026', $message['html']);
        self::assertStringContainsString('17.–19. Dezember 2026', $message['text']);
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

    public function testRendersReviewMailWithoutFeedbackWithTheExistingTheme(): void
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

        self::assertSame('Bitte prüfe deinen Wunschzettel', $message['subject']);
        self::assertStringContainsString('zur Prüfung zurückgegeben', $message['html']);
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
