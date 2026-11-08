<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\StartFulfillerReservationAction;
use App\Registration\Services\FulfillerAvailabilityService;
use App\Registration\Services\FulfillerReservationService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Slim\Psr7\Stream;
use Tests\Support\TestDatabase;

final class StartFulfillerReservationActionTest extends TestCase
{
    public function testRejectsReservationBeforeFulfillerStartDate(): void
    {
        $pdo = TestDatabase::create();
        $this->addFulfillerConfiguration($pdo, '2026-09-01', '2026-12-31');
        $action = new StartFulfillerReservationAction(
            null,
            new FulfillerReservationService($pdo),
            new FrontendConfigRepository($pdo),
            new DateTimeImmutable('2026-08-31 12:00:00', new DateTimeZone('UTC')),
            new FulfillerAvailabilityService($pdo, new FrontendConfigRepository($pdo)),
        );

        $response = $action($this->request(), new Response());

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('FULFILLER_NOT_STARTED', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    public function testRejectsReservationAfterFulfillerEndDate(): void
    {
        $pdo = TestDatabase::create();
        $this->addFulfillerConfiguration($pdo, '2026-01-01', '2026-08-31');
        $action = new StartFulfillerReservationAction(
            null,
            new FulfillerReservationService($pdo),
            new FrontendConfigRepository($pdo),
            new DateTimeImmutable('2026-09-01 12:00:00', new DateTimeZone('UTC')),
            new FulfillerAvailabilityService($pdo, new FrontendConfigRepository($pdo)),
        );

        $response = $action($this->request(), new Response());

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('FULFILLER_ENDED', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    public function testRejectsReservationWhenTheOrderItemLimitIsExceeded(): void
    {
        $pdo = TestDatabase::create();
        $this->addFulfillerConfiguration($pdo, '2026-01-01', '2026-12-31', '1');
        $pdo->exec("INSERT INTO orders (id, user_id, year, status) VALUES ('order-1', 'user-1', 2026, 'definitive')");
        $pdo->exec(
            "INSERT INTO order_items
                (id, order_id, original_description, current_description, status, publication_status, fulfillment_status)
             VALUES ('item-1', 'order-1', 'Wunsch', 'Wunsch', 'approved', 'approved', 'available'),
                    ('item-2', 'order-1', 'Wunsch', 'Wunsch', 'approved', 'approved', 'available')",
        );
        $action = new StartFulfillerReservationAction(
            null,
            new FulfillerReservationService($pdo),
            new FrontendConfigRepository($pdo),
            new DateTimeImmutable('2026-08-31 12:00:00', new DateTimeZone('UTC')),
            new FulfillerAvailabilityService($pdo, new FrontendConfigRepository($pdo)),
        );

        $response = $action($this->request(), new Response());

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('FULFILLER_ENDED', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    private function addFulfillerConfiguration(
        \PDO $pdo,
        string $startDate,
        string $endDate,
        string $maximumOrderItems = '600',
    ): void {
        foreach ([
            ['campaign-year', 'campaign_year', '2026'],
            ['fulfiller-start', 'fulfiller_start_date', $startDate],
            ['fulfiller-end', 'fulfiller_end_date', $endDate],
            ['maximum-orders', 'maximum_orders_per_year', '999999'],
            ['maximum-order-items', 'maximum_order_items_per_year', $maximumOrderItems],
        ] as [$id, $variableName, $value]) {
            $pdo->prepare(
                'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([
                $id,
                $variableName,
                json_encode($value, JSON_THROW_ON_ERROR),
                '["admin"]',
                '["admin"]',
                $variableName,
            ]);
        }
    }

    private function request(): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode([
            'itemId' => 'item-1',
            'email' => 'person@example.com',
            'language' => 'de',
            'privacyAccepted' => true,
        ], JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new ServerRequestFactory())
            ->createServerRequest('POST', '/public/fulfiller-reservation-start')
            ->withBody(new Stream($stream));
    }
}
