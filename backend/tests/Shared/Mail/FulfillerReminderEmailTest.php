<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Shared\Mail\EmailSender;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class FulfillerReminderEmailTest extends TestCase
{
    public function testRendersAllWishesHandoverAndPostInstructionsInHtmlAndPlainText(): void
    {
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee');
        $message = $sender->renderFulfillerReminder([
            ['wishNumber' => '179-1', 'title' => 'Ball', 'currentDescription' => 'Ein roter Ball'],
            ['wishNumber' => '180-2', 'title' => 'Buch', 'currentDescription' => "Ein Buch\nZweite Zeile"],
        ], ['date' => '17.–19. Dezember 2026', 'time' => '10–12 Uhr', 'location' => "Saal A\nMusterstrasse 1"]);
        foreach (['html', 'text'] as $format) {
            self::assertStringContainsString('Danke, dass du Weihnachtswünsche erfüllst! Gerne erinnern wir dich an die bevorstehenden Abgabetermine für die Geschenke zu folgenden Wünschen:', $message[$format]);
            self::assertStringNotContainsString('noch kein Geschenk eingegangen', $message[$format]);
            foreach (['179-1', '180-2', 'Ein roter Ball', 'Ein Buch', 'Zweite Zeile', '17.–19. Dezember 2026', '10–12 Uhr', 'Saal A', 'Musterstrasse 1', 'per Post', 'Wunschnummer'] as $text) {
                self::assertStringContainsString($text, $message[$format]);
            }
            self::assertStringNotContainsString('app.mail.', $message[$format]);
        }
        self::assertStringContainsString("Saal A\nMusterstrasse 1", $message['text']);
    }

    public function testAdminTestEmailUsesTheReminderTemplate(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            return str_contains($email->getTextBody(), '179-1')
                && str_contains($email->getTextBody(), 'per Post')
                && count($email->getAttachments()) === 1;
        }));
        (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee'))->sendTestEmail('test@example.com', 'fulfiller-reminder', [
            'wishNumber' => '179-1', 'wishTitle' => 'Ball', 'wishDescription' => 'Ein roter Ball',
            'handoverDate' => '17.–19. Dezember 2026', 'handoverTime' => '10–12 Uhr', 'handoverLocation' => 'Saal A',
        ]);
    }
}
