<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Data\FulfillerReservationRepository;
use App\Registration\Data\FulfillerReservationTokenRepository;
use App\Registration\Services\FulfillerReservationService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class FulfillerReservationServiceTest extends TestCase
{
    public function testReservationIsHeldAndCanBeConfirmedWithItsToken(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        $pdo->exec("INSERT INTO order_items (id, order_id, category, original_description, current_description, status, publication_status, fulfillment_status, item_number) VALUES ('item-1', 'order-1', 'gift', 'Bauklötze', 'Bauklötze', 'approved', 'approved', 'available', 1)");
        $now = new DateTimeImmutable('2026-10-31 12:00:00', new DateTimeZone('UTC'));
        $service = new FulfillerReservationService(
            $pdo,
            new FulfillerReservationRepository($pdo),
            new FulfillerReservationTokenRepository($pdo),
        );

        $reservation = $service->request('item-1', 'person@example.com', $now, $now);

        self::assertNotNull($reservation);
        self::assertSame('pending_confirmation', $pdo->query("SELECT fulfillment_status FROM order_items WHERE id = 'item-1'")->fetchColumn());

        $confirmation = $service->confirm($reservation['token'], $now->modify('+1 minute'));

        self::assertSame('confirmed', $confirmation['status']);
        self::assertSame('reserved', $pdo->query("SELECT fulfillment_status FROM order_items WHERE id = 'item-1'")->fetchColumn());
    }

    public function testExpiredHoldBecomesAvailableAgain(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        $pdo->exec("INSERT INTO order_items (id, order_id, category, original_description, current_description, status, publication_status, fulfillment_status, item_number) VALUES ('item-1', 'order-1', 'gift', 'Bauklötze', 'Bauklötze', 'approved', 'approved', 'available', 1)");
        $now = new DateTimeImmutable('2026-10-31 12:00:00', new DateTimeZone('UTC'));
        $service = new FulfillerReservationService($pdo);

        self::assertNotNull($service->request('item-1', 'person@example.com', $now, $now));
        $service->request('item-1', 'other@example.com', $now->modify('+11 minutes'), $now->modify('+11 minutes'));

        self::assertSame('pending_confirmation', $pdo->query("SELECT fulfillment_status FROM order_items WHERE id = 'item-1'")->fetchColumn());
        self::assertSame('other@example.com', $pdo->query("SELECT fulfiller_email FROM order_items WHERE id = 'item-1'")->fetchColumn());
    }
}
