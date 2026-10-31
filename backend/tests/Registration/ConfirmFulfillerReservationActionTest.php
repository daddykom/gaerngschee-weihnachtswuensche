<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\ConfirmFulfillerReservationAction;
use App\Registration\Data\FulfillerReservationRepository;
use App\Registration\Data\FulfillerReservationTokenRepository;
use App\Registration\Services\FulfillerReservationService;
use App\Shared\Mail\EmailQueueRepository;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;
use Tests\Support\RecordingEmailSender;
use Tests\Support\TestDatabase;

final class ConfirmFulfillerReservationActionTest extends TestCase
{
    public function testFailedConfirmationEmailIsQueuedAfterSuccessfulReservationConfirmation(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        $pdo->exec("INSERT INTO order_items (id, order_id, category, original_description, current_description, status, publication_status, fulfillment_status, item_number) VALUES ('item-1', 'order-1', 'gift', 'Bauklötze', 'Bauklötze', 'approved', 'approved', 'available', 1)");
        $this->addHandoverConfiguration($pdo);
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $service = new FulfillerReservationService(
            $pdo,
            new FulfillerReservationRepository($pdo),
            new FulfillerReservationTokenRepository($pdo),
        );
        $reservation = $service->request('item-1', 'person@example.com', $now, $now);
        self::assertNotNull($reservation);

        $emails = new RecordingEmailSender();
        $emails->failStoredEmail = true;
        $action = new ConfirmFulfillerReservationAction(
            $service,
            new FrontendConfigRepository($pdo),
            $emails,
            new EmailQueueRepository($pdo),
        );

        $response = $action($this->request($reservation['token']), new Response());
        $queued = (new EmailQueueRepository($pdo))->pending();

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('reserved', $pdo->query("SELECT fulfillment_status FROM order_items WHERE id = 'item-1'")->fetchColumn());
        self::assertCount(1, $queued);
        self::assertSame('fulfiller_reservation', $queued[0]['reference_type']);
        self::assertSame('item-1', $queued[0]['reference_id']);
        self::assertSame('fulfiller_reservation_confirmation', $queued[0]['email_type']);
    }

    private function request(string $token): ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode(['token' => $token], JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new ServerRequestFactory())->createServerRequest('POST', '/auth/fulfiller-reservation-confirm')
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new Stream($stream));
    }

    private function addHandoverConfiguration(\PDO $pdo): void
    {
        foreach ([
            ['date', 'fulfiller_handover_date', '2026-12-19'],
            ['time', 'fulfiller_handover_time', '10:00–12:00 Uhr'],
            ['location', 'fulfiller_handover_location', 'Clarastrasse 10, 4058 Basel'],
        ] as [$id, $name, $value]) {
            $pdo->prepare(
                'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
                 VALUES (:id, :name, :value, :access, :update, :label)',
            )->execute([
                'id' => 'config-' . $id,
                'name' => $name,
                'value' => json_encode($value, JSON_THROW_ON_ERROR),
                'access' => json_encode(['wunschbesteller'], JSON_THROW_ON_ERROR),
                'update' => json_encode(['admin'], JSON_THROW_ON_ERROR),
                'label' => $name,
            ]);
        }
    }
}
