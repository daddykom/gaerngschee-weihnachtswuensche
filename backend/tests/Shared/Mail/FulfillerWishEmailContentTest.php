<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Registration\Services\AnmeldungMailVariant;
use App\Shared\Mail\EmailSender;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class FulfillerWishEmailContentTest extends TestCase
{
    public static function wishLinks(): array
    {
        return ['missing' => [[]], 'null' => [['giftLink' => null]], 'empty' => [['giftLink' => '']], 'present' => [['giftLink' => 'https://example.com/gift']]];
    }

    #[DataProvider('wishLinks')]
    public function testBothEmailsContainEditedContentAndOnlyIncludePresentLinks(array $link): void
    {
        $wish = [
            'wishNumber' => '12-1', 'title' => 'Edited <title>',
            'currentDescription' => "Edited <description>\nSecond line", ...$link,
            'originalTitle' => 'Private original title', 'personalMessage' => 'Private team message',
        ];
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(function (Email $email) use ($link): bool {
            $this->assertWishContent($email->getHtmlBody(), $email->getTextBody(), !empty($link['giftLink']));
            return true;
        }));
        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee');
        $sender->sendAnmeldung('person@example.com', AnmeldungMailVariant::FulfillerReservation, 'de', 'https://example.com/confirm', $wish);
        $confirmation = $sender->renderFulfillerReservationConfirmation($wish, ['date' => 'Tomorrow', 'time' => '10–12', 'location' => 'Basel']);
        $this->assertWishContent($confirmation['html'], $confirmation['text'], !empty($link['giftLink']));
    }

    #[DataProvider('wishLinks')]
    public function testBothAdminTestEmailsUseTheSameWishContent(array $link): void
    {
        foreach (['fulfiller-reservation', 'fulfiller-reservation-confirmation'] as $template) {
            $mailer = $this->createMock(MailerInterface::class);
            $mailer->expects(self::once())->method('send')->with(self::callback(function (Email $email) use ($link): bool {
                $this->assertWishContent($email->getHtmlBody(), $email->getTextBody(), !empty($link['giftLink']));
                return true;
            }));
            (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee'))->sendTestEmail('person@example.com', $template, [
                'loginUrl' => 'https://example.com/confirm', 'wishNumber' => '12-1',
                'wishTitle' => 'Edited <title>', 'wishDescription' => "Edited <description>\nSecond line",
                'handoverDate' => 'Tomorrow', 'handoverTime' => '10–12', 'handoverLocation' => 'Basel',
                ...($link === [] ? [] : ['wishLink' => $link['giftLink']]),
            ]);
        }
    }

    private function assertWishContent(string $html, string $text, bool $hasLink): void
    {
        self::assertStringContainsString('Edited &lt;title&gt;', $html);
        self::assertStringContainsString('<strong>Wunschnummer:</strong> 12-1<br><strong>Edited &lt;title&gt;</strong><br>', $html);
        self::assertStringContainsString("Wunschnummer: 12-1\nEdited <title>\n", $text);
        self::assertStringContainsString('Edited &lt;description&gt;<br />', $html);
        self::assertStringContainsString('Edited <title>', $text);
        self::assertStringContainsString("Edited <description>\nSecond line", $text);
        foreach ([$html, $text] as $body) {
            self::assertStringContainsString('12-1', $body);
            self::assertStringNotContainsString('Private', $body);
            self::assertStringNotContainsString('app.mail.', $body);
        }
        if ($hasLink) {
            self::assertStringContainsString('href="https://example.com/gift"', $html);
            self::assertStringContainsString('Link zum gewünschten Geschenk (https://example.com/gift)', $text);
        } else {
            self::assertStringNotContainsString('Link zum gewünschten Geschenk', $html);
            self::assertStringNotContainsString('Link zum gewünschten Geschenk', $text);
        }
    }
}
