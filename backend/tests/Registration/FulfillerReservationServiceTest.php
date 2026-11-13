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
    public function testPublicWishesExposeOnlyEditedContentAndNeverSearchPrivateMessages(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        $pdo->exec("INSERT INTO order_items
            (id, order_id, category, original_title, current_title, original_description, current_description,
             original_reason, current_reason, personal_message, gift_link, status, publication_status, fulfillment_status, item_number)
            VALUES ('item-1', 'order-1', 'gift', 'Private original title', 'Edited title', 'Private original description',
                    'Edited description', 'Private original reason', 'Private legacy message', 'Private team message',
                    'https://example.com/gift', 'approved', 'approved', 'available', 1)");
        $repository = new FulfillerReservationRepository($pdo);

        foreach ([$repository->findPublicOrders()[0]['items'][0], $repository->findPublicWish('item-1')] as $wish) {
            self::assertSame('Edited title', $wish['title']);
            self::assertSame('Edited description', $wish['currentDescription']);
            self::assertSame('https://example.com/gift', $wish['giftLink']);
            foreach (['originalTitle', 'originalDescription', 'originalReason', 'currentReason', 'personalMessage'] as $field) {
                self::assertArrayNotHasKey($field, $wish);
            }
            self::assertStringNotContainsString('Private', json_encode($wish, JSON_THROW_ON_ERROR));
        }

        foreach (['Private original', 'Private legacy message', 'Private team message'] as $search) {
            self::assertSame([], $repository->findPublicOrders($search));
        }
        self::assertCount(1, $repository->findPublicOrders('Edited title'));
        self::assertCount(1, $repository->findPublicOrders('Edited description'));
    }

    public function testReservationIsHeldAndCanBeConfirmedWithItsToken(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        $pdo->exec("INSERT INTO order_items (id, order_id, category, original_description, current_description, status, publication_status, fulfillment_status, item_number) VALUES ('item-1', 'order-1', 'gift', 'Bauklötze', 'Bauklötze', 'approved', 'approved', 'available', 1)");
        $pdo->exec("UPDATE order_items SET original_title = 'Private original title', current_title = 'Edited wish title' WHERE id = 'item-1'");
        $now = new DateTimeImmutable('2026-10-31 12:00:00', new DateTimeZone('UTC'));
        $service = new FulfillerReservationService(
            $pdo,
            new FulfillerReservationRepository($pdo),
            new FulfillerReservationTokenRepository($pdo),
        );

        $reservation = $service->request('item-1', 'person@example.com', $now, $now);

        self::assertNotNull($reservation);
        self::assertSame('Edited wish title', $reservation['wish']['title']);
        self::assertArrayNotHasKey('originalTitle', $reservation['wish']);
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

    public function testPublicListExcludesDefinitivelyReservedWishesButStatusRefreshKeepsThemVisible(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        foreach ([
            ['item-available', 'available'],
            ['item-pending', 'pending_confirmation'],
            ['item-reserved', 'reserved'],
        ] as [$id, $status]) {
            $pdo->prepare(
                "INSERT INTO order_items
                    (id, order_id, category, original_description, current_description, status,
                     publication_status, fulfillment_status, item_number)
                 VALUES (:id, 'order-1', 'gift', :description, :description, 'approved', 'approved', :status, :item_number)",
            )->execute([
                'id' => $id,
                'description' => $id,
                'status' => $status,
                'item_number' => count($pdo->query('SELECT id FROM order_items')->fetchAll()) + 1,
            ]);
        }

        $repository = new FulfillerReservationRepository($pdo);
        $orders = $repository->findPublicOrders();
        $statuses = $repository->findPublicStatuses();

        self::assertCount(2, $orders[0]['items']);
        self::assertSame(['item-available', 'item-pending'], array_column($orders[0]['items'], 'id'));
        self::assertSame(
            ['item-available', 'item-pending', 'item-reserved'],
            array_column($statuses, 'id'),
        );
    }
}
