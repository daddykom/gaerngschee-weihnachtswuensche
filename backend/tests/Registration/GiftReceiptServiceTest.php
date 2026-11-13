<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\GiftReceiptRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\RegistrationTokenRepository;
use App\Registration\Services\GiftReceiptException;
use App\Registration\Services\GiftReceiptService;
use App\Registration\Services\OrderBatchService;
use App\Shared\Mail\EmailQueueRepository;
use App\Users\Data\UserRepository;
use PDO;
use PHPUnit\Framework\TestCase;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

final class GiftReceiptServiceTest extends TestCase
{
    private PDO $pdo;
    private RecordingEmailSender $emails;
    private GiftReceiptService $service;
    private int $rendered = 0;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $user = (new UserRepository($this->pdo))->createUser('client@example.com', 'secret', 'wunschbesteller');
        $this->pdo->prepare("INSERT INTO orders (id, user_id, year, order_number, status) VALUES ('order', ?, 2026, 12, 'definitive')")->execute([$user['id']]);
        $insert = $this->pdo->prepare("INSERT INTO order_items (id, order_id, item_number, original_description, current_description, status, publication_status, fulfillment_status) VALUES (?, 'order', ?, 'Coat', 'Coat', 'approved', 'approved', 'reserved')");
        $insert->execute(['one', 1]);
        $insert->execute(['two', 2]);
        $this->emails = new RecordingEmailSender();
        $this->service = new GiftReceiptService(new GiftReceiptRepository($this->pdo), $this->emails, function (array $order, string $token): array {
            $this->rendered++;
            return ['subject' => 'Pickup', 'html' => $token, 'text' => 'QR ' . $token];
        });
    }

    public function testReceivesOneGiftWithoutReleasingOrSendingAndIgnoresDuplicateSubmissions(): void
    {
        $first = $this->service->receive(2026, 12, 1, false, false);
        self::assertSame('definitive', $first['order']['status']);
        self::assertSame('not_required', $first['mailStatus']);
        self::assertNotNull($first['order']['items'][0]['receivedAt']);
        self::assertSame('received', $first['order']['items'][0]['fulfillmentStatus']);
        self::assertSame('reserved', $first['order']['items'][1]['fulfillmentStatus']);
        $again = $this->service->receive(2026, 12, 1, false, false);
        self::assertTrue($again['alreadyReceived']);
        self::assertSame($first['order']['items'][0]['receivedAt'], $again['order']['items'][0]['receivedAt']);
        self::assertSame(0, $this->rendered);
        self::assertCount(0, $this->emails->orderConfirmations);
    }

    public function testLastGiftRequiresConfirmationThenReleasesAndSendsOnlyOnce(): void
    {
        $this->service->receive(2026, 12, 1, false, false);
        $this->expectConfirmation(2, false, false);
        self::assertNull($this->pdo->query("SELECT received_at FROM order_items WHERE id = 'two'")->fetchColumn());
        self::assertSame('definitive', $this->pdo->query("SELECT status FROM orders WHERE id = 'order'")->fetchColumn());
        $result = $this->service->receive(2026, 12, 2, false, true);
        self::assertSame('ready_for_pickup', $result['order']['status']);
        self::assertSame('sent', $result['mailStatus']);
        $hash = $this->pdo->query("SELECT pickup_token_hash FROM orders WHERE id = 'order'")->fetchColumn();
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $hash);
        self::assertSame(hash('sha256', $this->emails->orderConfirmations[0]['order']['html']), $hash);
        self::assertNotNull($this->pdo->query("SELECT pickup_notification_sent_at FROM orders WHERE id = 'order'")->fetchColumn());
        $this->service->receive(2026, 12, 2, true, true);
        self::assertCount(1, $this->emails->orderConfirmations);
        self::assertSame(1, $this->rendered);
        self::assertSame($hash, $this->pdo->query("SELECT pickup_token_hash FROM orders WHERE id = 'order'")->fetchColumn());
        self::assertCount(0, (new EmailQueueRepository($this->pdo))->pending());
    }

    public function testUnreservedAndPendingGiftsRequireExplicitWarningConfirmation(): void
    {
        foreach (['available', 'pending_confirmation'] as $status) {
            $this->pdo->prepare("UPDATE order_items SET fulfillment_status = ?, received_at = NULL WHERE id = 'one'")->execute([$status]);
            $this->expectConfirmation(1, false, false);
            self::assertNull($this->pdo->query("SELECT received_at FROM order_items WHERE id = 'one'")->fetchColumn());
            self::assertSame('received', $this->service->receive(2026, 12, 1, true, false)['order']['items'][0]['fulfillmentStatus']);
        }
    }

    public function testSmtpFailureKeepsTheCommittedReceiptAndBatchRetriesTheSameCode(): void
    {
        $this->service->receive(2026, 12, 1, false, false);
        $this->emails->failStoredEmail = true;
        $result = $this->service->receive(2026, 12, 2, false, true);
        self::assertSame('pending', $result['mailStatus']);
        self::assertSame('ready_for_pickup', $result['order']['status']);
        $pending = (new EmailQueueRepository($this->pdo))->pending();
        self::assertCount(1, $pending);
        $this->pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES ('retention', 'registration_token_retention_days', '\"365\"', '[]', '[]', 'Retention')");
        $this->emails->failStoredEmail = false;
        $batch = new OrderBatchService(new OrderRepository($this->pdo), new EmailQueueRepository($this->pdo), new FrontendConfigRepository($this->pdo), $this->emails, new RegistrationTokenRepository($this->pdo), giftReceipts: new GiftReceiptRepository($this->pdo));
        self::assertSame(1, $batch->run()['sent']);
        self::assertSame($pending[0]['html_body'], $this->emails->orderConfirmations[0]['order']['html']);
        self::assertSame(0, $batch->run()['sent']);
        self::assertNotNull($this->pdo->query("SELECT pickup_notification_sent_at FROM orders WHERE id = 'order'")->fetchColumn());
    }

    public function testRenderingFailureRollsBackBothReceiptAndRelease(): void
    {
        $this->service->receive(2026, 12, 1, false, false);
        $service = new GiftReceiptService(new GiftReceiptRepository($this->pdo), $this->emails, static function (): array {
            throw new \RuntimeException('Render failed');
        });
        try {
            $service->receive(2026, 12, 2, false, true);
            self::fail('Rendering must fail.');
        } catch (\RuntimeException $exception) {
            self::assertSame('Render failed', $exception->getMessage());
        }
        self::assertSame('definitive', $this->pdo->query("SELECT status FROM orders WHERE id = 'order'")->fetchColumn());
        self::assertNull($this->pdo->query("SELECT received_at FROM order_items WHERE id = 'two'")->fetchColumn());
        self::assertNull($this->pdo->query("SELECT pickup_token_hash FROM orders WHERE id = 'order'")->fetchColumn());
        self::assertCount(0, (new EmailQueueRepository($this->pdo))->pending());
    }

    public function testWrongYearAndNonDefinitiveOrdersCannotBeReceived(): void
    {
        foreach ([[2025, 'definitive', 'GIFT_NOT_FOUND'], [2026, 'draft', 'GIFT_NOT_RECEIVABLE']] as [$year, $status, $code]) {
            $this->pdo->prepare("UPDATE orders SET status = ? WHERE id = 'order'")->execute([$status]);
            try {
                $this->service->receive($year, 12, 1, true, true);
                self::fail('Receipt must be rejected.');
            } catch (GiftReceiptException $exception) {
                self::assertSame($code, $exception->getMessage());
            }
        }
    }

    private function expectConfirmation(int $item, bool $unreserved, bool $pickup): void
    {
        try {
            $this->service->receive(2026, 12, $item, $unreserved, $pickup);
            self::fail('Confirmation must be required.');
        } catch (GiftReceiptException $exception) {
            self::assertSame('RECEIPT_CONFIRMATION_REQUIRED', $exception->getMessage());
            self::assertSame(409, $exception->httpStatus);
            self::assertSame('definitive', $exception->result['order']['status']);
        }
    }
}
