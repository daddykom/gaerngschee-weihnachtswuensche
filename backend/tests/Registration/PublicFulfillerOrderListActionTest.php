<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\PublicFulfillerOrderListAction;
use App\Registration\Services\FulfillerAvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class PublicFulfillerOrderListActionTest extends TestCase
{
    public function testRejectsThePublicWishListWhenTheOrderItemLimitIsExceeded(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo);
        $pdo->exec("INSERT INTO orders (id, user_id, year, status) VALUES ('order-1', 'user-1', 2026, 'definitive')");
        $pdo->exec(
            "INSERT INTO order_items
                (id, order_id, original_description, current_description, status, publication_status, fulfillment_status)
             VALUES ('item-1', 'order-1', 'Wunsch', 'Wunsch', 'approved', 'approved', 'available'),
                    ('item-2', 'order-1', 'Wunsch', 'Wunsch', 'approved', 'approved', 'available')",
        );
        $configs = new FrontendConfigRepository($pdo);
        $action = new PublicFulfillerOrderListAction(
            null,
            $configs,
            new DateTimeImmutable('2026-08-31 12:00:00', new DateTimeZone('UTC')),
            new FulfillerAvailabilityService($pdo, $configs),
        );

        $response = $action(
            (new ServerRequestFactory())->createServerRequest('GET', '/public/fulfiller/orders'),
            new Response(),
        );

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('FULFILLER_ENDED', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    private function addConfiguration(\PDO $pdo): void
    {
        foreach ([
            ['campaign-year', 'campaign_year', '2026'],
            ['fulfiller-start', 'fulfiller_start_date', '2026-01-01'],
            ['fulfiller-end', 'fulfiller_end_date', '2026-12-31'],
            ['maximum-orders', 'maximum_orders_per_year', '999999'],
            ['maximum-items', 'maximum_order_items_per_year', '1'],
        ] as [$id, $variableName, $value]) {
            $pdo->prepare(
                'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([
                $id,
                $variableName,
                json_encode($value, JSON_THROW_ON_ERROR),
                '["admin", "wunschbesteller"]',
                '["admin"]',
                $variableName,
            ]);
        }
    }
}
