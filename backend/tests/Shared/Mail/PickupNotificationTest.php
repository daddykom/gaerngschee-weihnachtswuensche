<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Registration\Services\PickupCodeService;
use App\Registration\Services\QrCodeGenerator;
use App\Shared\Mail\EmailSender;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final class PickupNotificationTest extends TestCase
{
    public function testUsesTheRegistrationMailLayoutWithCenteredLogoAndQrImage(): void
    {
        $code = (new PickupCodeService())->create();
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee');
        $message = $sender->renderPickupNotification(['year' => 2026, 'orderNumber' => 12], $code['token']);
        $document = new \DOMDocument();
        $document->loadHTML($message['html']);
        $xpath = new \DOMXPath($document);
        $card = $xpath->query('//table[@width="600"]')->item(0);
        self::assertInstanceOf(\DOMElement::class, $card);
        self::assertStringContainsString('border-radius:20px', $card->getAttribute('style'));
        self::assertStringContainsString('border:1px solid #8c7b85', $card->getAttribute('style'));
        $logoParent = $xpath->query('//img[@alt="Gärngschee"]/parent::td')->item(0);
        $qrParent = $xpath->query('//img[@id="pickup-qr-code"]/parent::td')->item(0);
        self::assertInstanceOf(\DOMElement::class, $logoParent);
        self::assertInstanceOf(\DOMElement::class, $qrParent);
        self::assertSame('center', $logoParent->getAttribute('align'));
        self::assertSame('center', $qrParent->getAttribute('align'));
        self::assertStringContainsString('background-color:#dff4e8', $message['html']);
        self::assertStringContainsString('bgcolor="#8a2858"', $message['html']);
        self::assertStringContainsString('Dein Wunschzettel ist vollständig.', $message['html']);
        self::assertStringContainsString('QR-Code als PNG öffnen', $message['html']);
        self::assertStringContainsString($code['imageUrl'], $message['text']);
    }

    public function testRendersAndEmbedsTheSameQrCodeOnEveryStoredMessageRetry(): void
    {
        $code = (new PickupCodeService())->create();
        $png = (new QrCodeGenerator())->generatePng($code['pickupUrl']);
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::exactly(2))->method('send')->with(self::callback(static function (Email $email) use ($code, $png): bool {
            self::assertSame('recipient@example.com', $email->getTo()[0]->getAddress());
            self::assertStringContainsString('cid:pickup-qr-code', $email->getHtmlBody());
            self::assertStringNotContainsString('data:image/png', $email->getHtmlBody());
            self::assertStringContainsString($code['imageUrl'], $email->getHtmlBody());
            self::assertStringContainsString($code['imageUrl'], $email->getTextBody());
            $images = array_values(array_filter($email->getAttachments(), static fn ($part): bool => $part->getFilename() === 'pickup-qr-code'));
            self::assertCount(1, $images);
            self::assertSame('inline', $images[0]->getDisposition());
            self::assertSame($png, $images[0]->getBody());
            self::assertCount(2, $email->getAttachments());
            self::assertStringContainsString('Content-ID:', $email->toString());

            return true;
        }));
        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee');
        $message = $sender->renderPickupNotification(['year' => 2026, 'orderNumber' => 12], $code['token']);
        self::assertStringContainsString('Wunschzettels 12', $message['html']);
        self::assertStringContainsString('2026', $message['html']);
        self::assertStringNotContainsString('app.mail.pickup', $message['html']);
        self::assertStringNotContainsString($code['tokenHash'], $message['html']);
        self::assertStringContainsString($code['imageUrl'], $message['text']);
        self::assertStringNotContainsString('data:image/png', $message['text']);
        self::assertStringContainsString(base64_encode($png), $message['html']);
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $sender->sendStoredEmail('recipient@example.com', $message['subject'], $message['html'], $message['text']);
        }
    }

    public function testAdminTestEmailUsesTheSameRendererWithoutAssigningARealOrder(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            self::assertStringContainsString('Wunschzettels 42', $email->getHtmlBody());
            self::assertStringContainsString('cid:pickup-qr-code', $email->getHtmlBody());
            self::assertMatchesRegularExpression('~/public/pickup-qr-code/[a-f0-9]{64}~', $email->getTextBody());
            self::assertCount(2, $email->getAttachments());
            return true;
        }));
        (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee'))->sendTestEmail('recipient@example.com', 'order-ready-for-pickup', ['year' => '2026', 'orderNumber' => '42']);
    }
}
