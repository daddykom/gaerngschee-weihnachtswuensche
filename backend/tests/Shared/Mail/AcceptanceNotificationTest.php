<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Configuration\Data\FrontendConfigRepository;
use App\Shared\Mail\EmailSender;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Tests\Support\TestDatabase;

final class AcceptanceNotificationTest extends TestCase
{
    public function testRendersAcceptanceWithConfiguredPickupDetailsButNoQrCode(): void
    {
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee', frontendConfig: $this->config());
        $message = $sender->renderOrderConfirmation(['year' => 2026, 'orderNumber' => 179], 'definitive');
        foreach ([$message['html'], $message['text']] as $body) {
            self::assertStringContainsString('Alle Wünsche deines Wunschzettels 179', $body);
            self::assertStringContainsString('2026', $body);
            self::assertStringContainsString('Samstag, 14–17 Uhr', $body);
            self::assertStringContainsString('eine weitere E-Mail', $body);
            self::assertStringContainsString('Abhol-QR-Code', $body);
            self::assertStringNotContainsString('app.mail.', $body);
            self::assertStringNotContainsString('/abholung/', $body);
            self::assertStringNotContainsString('id="pickup-qr-code"', $body);
        }
        self::assertStringContainsString('Saal &lt;b&gt;West&lt;/b&gt;<br />', $message['html']);
        self::assertStringContainsString("Saal <b>West</b>\nHauptstrasse 1", $message['text']);
        self::assertSame('Alle deine Weihnachtswünsche wurden angenommen', $message['subject']);
    }

    public function testRejectsMissingPickupDetailsInsteadOfSendingAnIncompleteMessage(): void
    {
        $sender = new EmailSender($this->createMock(MailerInterface::class), 'noreply@example.com', 'Gärngschee', frontendConfig: new FrontendConfigRepository(TestDatabase::create()));
        $this->expectException(\RuntimeException::class);
        $sender->renderOrderConfirmation(['year' => 2026, 'orderNumber' => 1], 'definitive');
    }

    public function testAdminTestAllowsOverridesWithoutWritingPickupConfiguration(): void
    {
        $config = $this->config();
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            self::assertStringContainsString('Testtermin ohne Format', $email->getTextBody());
            self::assertStringContainsString("Testsaal\nTeststrasse 2", $email->getTextBody());
            self::assertStringNotContainsString('Hauptstrasse 1', $email->getTextBody());
            self::assertCount(1, $email->getAttachments());
            return true;
        }));
        (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee', frontendConfig: $config))->sendTestEmail('recipient@example.com', 'order-confirmation-definitive', [
            'year' => 2026, 'orderNumber' => 179, 'pickupDate' => 'Testtermin ohne Format', 'pickupLocation' => "Testsaal\nTeststrasse 2",
        ]);
        self::assertSame('Samstag, 14–17 Uhr', $config->findValueByVariableName('pickup_date'));
    }

    public function testEmptyTestOverridesUseConfiguredDetails(): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::once())->method('send')->with(self::callback(static function (Email $email): bool {
            self::assertStringContainsString('Samstag, 14–17 Uhr', $email->getTextBody());
            self::assertStringContainsString("Saal <b>West</b>\nHauptstrasse 1", $email->getTextBody());
            return true;
        }));
        (new EmailSender($mailer, 'noreply@example.com', 'Gärngschee', frontendConfig: $this->config()))->sendTestEmail('recipient@example.com', 'order-confirmation-definitive', ['year' => 2026, 'orderNumber' => 1, 'pickupDate' => '', 'pickupLocation' => ' ']);
    }

    private function config(): FrontendConfigRepository
    {
        $pdo = TestDatabase::create();
        $insert = $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)');
        foreach (['pickup_date' => 'Samstag, 14–17 Uhr', 'pickup_location' => "Saal <b>West</b>\nHauptstrasse 1"] as $key => $value) {
            $insert->execute([$key, $key, json_encode($value), '["admin"]', '["admin"]', $key]);
        }
        return new FrontendConfigRepository($pdo);
    }
}
