<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\PublicFulfillerWishImageAction;
use App\Registration\Data\FulfillerReservationRepository;
use App\Registration\Data\OrderItemImageRepository;
use App\Registration\Services\FulfillerAvailabilityService;
use App\Registration\Services\OrderItemImageProcessor;
use App\Routes\PublicRoutes;
use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\OrderItemImageFixture;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../Support/OrderItemImageFixture.php';

final class PublicFulfillerWishImageActionTest extends TestCase
{
    private PDO $pdo;
    private OrderItemImageRepository $images;
    private FrontendConfigRepository $configs;
    private array $state;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->pdo->exec("INSERT INTO orders (id, user_id, year, status, order_number) VALUES ('order-1', 'user-1', 2026, 'definitive', 12)");
        $this->pdo->exec("INSERT INTO order_items
            (id, order_id, category, current_title, original_description, current_description, status, publication_status, fulfillment_status, item_number)
            VALUES ('item-1', 'order-1', 'gift', 'Public wish', 'Private original', 'Public description', 'approved', 'approved', 'available', 1),
                   ('item-2', 'order-1', 'gift', 'No image', 'Private original', 'Public description', 'approved', 'approved', 'available', 2)");
        foreach (['fulfiller_start_date' => '2026-01-01', 'fulfiller_end_date' => '2026-12-31'] as $key => $value) {
            $this->pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$key, $key, json_encode($value), '["admin"]', '["admin"]', $key]);
        }
        $this->configs = new FrontendConfigRepository($this->pdo);
        $this->images = new OrderItemImageRepository($this->pdo);
        $this->state = $this->store('png', 0);
    }

    private function store(string $format, int $revision): array
    {
        return $this->images->replace('order-1', 'item-1', $revision, (new OrderItemImageProcessor())->process(
            OrderItemImageFixture::upload(OrderItemImageFixture::bytes($format)),
        ));
    }

    private function get(?string $imageId = null, string $itemId = 'item-1', string $date = '2026-08-01'): \Psr\Http\Message\ResponseInterface
    {
        $action = new PublicFulfillerWishImageAction(
            $this->images,
            $this->configs,
            new FulfillerAvailabilityService($this->pdo, $this->configs),
            new DateTimeImmutable($date),
        );
        return $action((new ServerRequestFactory())->createServerRequest('GET', '/public/fulfiller/wishes/image'), new Response(), [
            'itemId' => $itemId,
            'imageId' => $imageId ?? $this->state['image']['id'],
        ]);
    }

    public function testPublicListExposesOnlyImagePathsAndNoImageBytesOrPrivateMetadata(): void
    {
        $orders = (new FulfillerReservationRepository($this->pdo))->findPublicOrders();
        $wish = $orders[0]['items'][0];
        self::assertSame('/public/fulfiller/wishes/item-1/images/' . $this->state['image']['id'], $wish['imagePath']);
        self::assertNull($orders[0]['items'][1]['imagePath']);
        self::assertArrayNotHasKey('image_data', $wish);
        self::assertArrayNotHasKey('mimeType', $wish);
        self::assertStringNotContainsString('Private original', json_encode($orders));
        self::assertStringNotContainsString(base64_encode(OrderItemImageFixture::bytes()), json_encode($orders));
    }

    public function testServesAllAcceptedFormatsWithoutLoginAndWithoutChangingTheWish(): void
    {
        foreach (['png' => 'image/png', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp'] as $format => $mime) {
            $this->state = $this->store($format, $this->state['revision']);
            $before = $this->pdo->query('SELECT * FROM order_items')->fetchAll();
            $response = $this->get();
            self::assertSame(200, $response->getStatusCode());
            self::assertSame($mime, $response->getHeaderLine('Content-Type'));
            self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
            self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
            self::assertSame((string) strlen((string) $response->getBody()), $response->getHeaderLine('Content-Length'));
            self::assertNotFalse(imagecreatefromstring((string) $response->getBody()));
            self::assertSame($before, $this->pdo->query('SELECT * FROM order_items')->fetchAll());
        }
    }

    public static function hiddenStates(): array
    {
        return [
            ['draft', 'approved'], ['released', 'approved'], ['in_review', 'approved'],
            ['changes_requested', 'approved'], ['ready_for_pickup', 'approved'], ['completed', 'approved'],
            ['definitive', 'draft'], ['definitive', 'submitted'], ['definitive', 'rejected'],
        ];
    }

    #[DataProvider('hiddenStates')]
    public function testHidesNonPublicWishesEvenWithAKnownImageUrl(string $orderStatus, string $publicationStatus): void
    {
        $this->pdo->prepare('UPDATE orders SET status = ?')->execute([$orderStatus]);
        $this->pdo->prepare("UPDATE order_items SET publication_status = ? WHERE id = 'item-1'")->execute([$publicationStatus]);
        $response = $this->get();
        self::assertSame(404, $response->getStatusCode());
        self::assertSame('no-store', $response->getHeaderLine('Cache-Control'));
        self::assertStringNotContainsString('image_data', (string) $response->getBody());
    }

    public function testRejectsOldMissingAndMismatchedImages(): void
    {
        self::assertSame(404, $this->get(itemId: 'item-2')->getStatusCode());
        self::assertSame(404, $this->get('unknown')->getStatusCode());
        $oldId = $this->state['image']['id'];
        $this->state = $this->store('jpeg', 1);
        self::assertSame(404, $this->get($oldId)->getStatusCode());
        self::assertSame(200, $this->get()->getStatusCode());
        $this->images->remove('order-1', 'item-1', 2);
        self::assertSame(404, $this->get()->getStatusCode());
    }

    public function testExistingCardsCanStillLoadImagesAfterReservationButNotAfterWithdrawal(): void
    {
        $this->pdo->exec("UPDATE order_items SET fulfillment_status = 'reserved' WHERE id = 'item-1'");
        self::assertSame(200, $this->get()->getStatusCode());
        $this->pdo->exec("UPDATE orders SET status = 'in_review'");
        self::assertSame(404, $this->get()->getStatusCode());
    }

    public function testUsesTheSameCampaignWindowAsThePublicList(): void
    {
        foreach (['2025-12-31' => 'FULFILLER_NOT_STARTED', '2027-01-01' => 'FULFILLER_ENDED'] as $date => $code) {
            $response = $this->get(date: $date);
            self::assertSame(403, $response->getStatusCode());
            self::assertSame($code, json_decode((string) $response->getBody(), true)['error']['code']);
        }
    }

    public function testRegistersAnUnauthenticatedReadOnlyImageRoute(): void
    {
        $app = AppFactory::create();
        PublicRoutes::register($app);
        $routes = array_values(array_filter($app->getRouteCollector()->getRoutes(), static fn ($route) =>
            $route->getPattern() === '/public/fulfiller/wishes/{itemId}/images/{imageId}'));
        self::assertCount(1, $routes);
        self::assertSame(['GET'], $routes[0]->getMethods());
    }
}
