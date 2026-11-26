<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Auth\Services\SessionService;
use App\Middleware\CsrfMiddleware;
use App\Registration\Data\OrderItemImageRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\OrderItemImageException;
use App\Registration\Services\OrderItemImageProcessor;
use App\Routes\AdminRoutes;
use App\Users\Data\UserRepository;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Stream;
use Slim\App;
use Tests\Support\OrderItemImageFixture;
use Tests\Support\TestDatabase;

require_once __DIR__ . '/../Support/OrderItemImageFixture.php';

final class OrderItemImageTest extends TestCase
{
    private PDO $pdo;
    private OrderItemImageRepository $images;
    private UserRepository $users;
    private array $order;
    private App $app;
    private string $path;

    protected function setUp(): void
    {
        (new SessionService())->clear();
        $this->pdo = TestDatabase::create();
        $this->images = new OrderItemImageRepository($this->pdo);
        $this->users = new UserRepository($this->pdo);
        $admin = $this->users->createUser('admin-image@example.com', 'secret', 'admin');
        $owner = $this->users->createUser('owner-image@example.com', 'secret', 'wunschbesteller');
        $this->order = (new OrderRepository($this->pdo))->saveForYear($owner['id'], 2026, 'draft', 1, 0, [
            ['category' => 'gift', 'title' => 'Wish', 'description' => 'Original wish description'],
        ]);
        $this->path = '/admin/orders/' . $this->order['id'] . '/items/' . $this->order['items'][0]['id'] . '/image';
        (new SessionService())->setUser($admin['id'], 'admin');
        $this->app = AppFactory::create();
        $this->app->addRoutingMiddleware();
        $this->app->add(new CsrfMiddleware());
        AdminRoutes::register($this->app, userRepository: $this->users, orderItemImages: $this->images);
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    public static function imageTypes(): array
    {
        return ['PNG' => ['png', 'image/png'], 'JPEG' => ['jpeg', 'image/jpeg'], 'WebP' => ['webp', 'image/webp']];
    }

    #[DataProvider('imageTypes')]
    public function testValidatesActualPixelsAndRemovesTrailingContentRegardlessOfClientType(string $type, string $mime): void
    {
        $source = OrderItemImageFixture::bytes($type) . 'private-metadata-and-trailing-content';
        $result = (new OrderItemImageProcessor())->process(OrderItemImageFixture::upload($source));
        self::assertSame($mime, $result['mimeType']);
        self::assertSame(12, $result['width']);
        self::assertSame(8, $result['height']);
        self::assertSame(strlen($result['data']), $result['byteSize']);
        self::assertStringNotContainsString('private-metadata', $result['data']);
        self::assertNotFalse(imagecreatefromstring($result['data']));
    }

    public function testRemovesJpegExifMetadata(): void
    {
        $jpeg = OrderItemImageFixture::bytes('jpeg');
        $exif = "Exif\x00\x00private-location";
        $jpeg = substr($jpeg, 0, 2) . "\xff\xe1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2);
        $result = (new OrderItemImageProcessor())->process(OrderItemImageFixture::upload($jpeg));
        self::assertStringNotContainsString('private-location', $result['data']);
        self::assertStringNotContainsString("Exif\x00\x00", $result['data']);
    }

    public static function invalidImages(): array
    {
        return [
            'empty' => ['', 'INVALID_IMAGE'],
            'SVG' => ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'INVALID_IMAGE'],
            'text' => ['not an image', 'INVALID_IMAGE'],
            'oversized bytes' => [str_repeat('x', OrderItemImageProcessor::MAX_BYTES + 1), 'IMAGE_TOO_LARGE'],
            'oversized dimensions' => [
                "\x89PNG\r\n\x1a\n" . pack('N', 13) . 'IHDR' . pack('NNCCCCC', 8193, 1, 8, 2, 0, 0, 0) . str_repeat("\0", 4),
                'IMAGE_DIMENSIONS_EXCEEDED',
            ],
            'excessive pixels' => [
                "\x89PNG\r\n\x1a\n" . pack('N', 13) . 'IHDR' . pack('NNCCCCC', 4000, 4000, 8, 2, 0, 0, 0) . str_repeat("\0", 4),
                'IMAGE_DIMENSIONS_EXCEEDED',
            ],
        ];
    }

    #[DataProvider('invalidImages')]
    public function testRejectsUnsafeUploads(string $bytes, string $code): void
    {
        $this->expectException(OrderItemImageException::class);
        $this->expectExceptionMessage($code);
        (new OrderItemImageProcessor())->process(OrderItemImageFixture::upload($bytes));
    }

    public function testRejectsUnsupportedGifAndIncompleteUpload(): void
    {
        foreach ([
            OrderItemImageFixture::upload(OrderItemImageFixture::bytes('gif')),
            OrderItemImageFixture::upload('', 0, UPLOAD_ERR_PARTIAL),
            OrderItemImageFixture::upload('', 0, UPLOAD_ERR_INI_SIZE),
        ] as $upload) {
            try {
                (new OrderItemImageProcessor())->process($upload);
                self::fail('Expected the upload to be rejected.');
            } catch (OrderItemImageException $exception) {
                self::assertContains($exception->getMessage(), ['INVALID_IMAGE', 'IMAGE_UPLOAD_FAILED', 'IMAGE_TOO_LARGE']);
            }
        }
    }

    public function testStoresReadsReplacesAndDeletesWithoutChangingWishData(): void
    {
        $itemId = $this->order['items'][0]['id'];
        $this->pdo->prepare("UPDATE order_items SET updated_at = '2000-01-01 00:00:00' WHERE id = ?")->execute([$itemId]);
        $before = $this->pdo->query("SELECT * FROM order_items WHERE id = '$itemId'")->fetch();
        self::assertSame(['revision' => 0, 'image' => null], $this->json($this->request('GET', '/metadata')));
        $saved = $this->json($this->request('POST', '', ['revision' => '0'], OrderItemImageFixture::bytes()));
        self::assertSame(1, $saved['revision']);
        self::assertSame('image/png', $saved['image']['mimeType']);
        self::assertArrayNotHasKey('image_data', $saved['image']);
        $response = $this->request('GET');
        self::assertSame(200, $response->getStatusCode());
        self::assertSame('image/png', $response->getHeaderLine('Content-Type'));
        self::assertSame('private, no-store', $response->getHeaderLine('Cache-Control'));
        self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        self::assertNotFalse(imagecreatefromstring((string) $response->getBody()));
        $replacement = $this->json($this->request('POST', '', ['revision' => '1'], OrderItemImageFixture::bytes('jpeg')));
        self::assertSame(2, $replacement['revision']);
        self::assertNotSame($saved['image']['id'], $replacement['image']['id']);
        self::assertSame('image/jpeg', $replacement['image']['mimeType']);
        self::assertSame(['revision' => 3, 'image' => null], $this->json($this->request('DELETE', '', ['revision' => 2])));
        self::assertSame(404, $this->request('GET')->getStatusCode());
        $after = $this->pdo->query("SELECT * FROM order_items WHERE id = '$itemId'")->fetch();
        self::assertSame(3, (int) $after['image_revision']);
        self::assertNotSame($before['updated_at'], $after['updated_at']);
        unset($before['image_revision'], $before['updated_at'], $after['image_revision'], $after['updated_at']);
        self::assertSame($before, $after);
    }

    public function testOldUploadsAndDeletesCannotOverwriteANewerImageOrRemoval(): void
    {
        $bytes = OrderItemImageFixture::bytes();
        $this->request('POST', '', ['revision' => '0'], $bytes);
        self::assertSame(409, $this->request('POST', '', ['revision' => '0'], $bytes)->getStatusCode());
        self::assertSame(409, $this->request('DELETE', '', ['revision' => 0])->getStatusCode());
        $this->request('DELETE', '', ['revision' => 1]);
        self::assertSame(409, $this->request('POST', '', ['revision' => '0'], $bytes)->getStatusCode());
        self::assertSame(['revision' => 2, 'image' => null], $this->json($this->request('GET', '/metadata')));
    }

    public function testFailedReplacementRollsBackThePreviousImageAndRevision(): void
    {
        $this->request('POST', '', ['revision' => '0'], OrderItemImageFixture::bytes());
        $before = $this->json($this->request('GET', '/metadata'));
        $beforeBytes = (string) $this->request('GET')->getBody();
        $this->pdo->exec("CREATE TRIGGER fail_image_insert BEFORE INSERT ON order_item_images BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
        self::assertSame(500, $this->request('POST', '', ['revision' => '1'], OrderItemImageFixture::bytes('jpeg'))->getStatusCode());
        self::assertSame($before, $this->json($this->request('GET', '/metadata')));
        self::assertSame($beforeBytes, (string) $this->request('GET')->getBody());
    }

    public function testInvalidUploadPreservesThePreviousImage(): void
    {
        $this->request('POST', '', ['revision' => '0'], OrderItemImageFixture::bytes());
        $before = $this->json($this->request('GET', '/metadata'));
        self::assertSame(422, $this->request('POST', '', ['revision' => '1'], '<svg/>')->getStatusCode());
        self::assertSame($before, $this->json($this->request('GET', '/metadata')));
    }

    public function testRequiresRevisionAndImageAndRejectsMismatchedOrder(): void
    {
        self::assertSame(422, $this->request('POST', '', [], OrderItemImageFixture::bytes())->getStatusCode());
        self::assertSame(422, $this->request('POST', '', ['revision' => '0'])->getStatusCode());
        self::assertSame(422, $this->request('DELETE', '', ['revision' => -1])->getStatusCode());
        $this->path = str_replace($this->order['id'], 'another-order', $this->path);
        self::assertSame(404, $this->request('POST', '', ['revision' => '0'], OrderItemImageFixture::bytes())->getStatusCode());
        self::assertSame(404, $this->request('GET', '/metadata')->getStatusCode());
        self::assertSame(404, $this->request('DELETE', '', ['revision' => 0])->getStatusCode());
    }

    public function testRequiresAuthenticationAndAdminPermissionsForEveryEndpoint(): void
    {
        $session = new SessionService();
        foreach ([null, 'user', 'wunschbesteller', 'wunscherfueller'] as $group) {
            $session->clear();
            if ($group !== null) {
                $user = $this->users->createUser("$group-image@example.com", 'secret', $group);
                $session->setUser($user['id'], $group);
            }
            foreach ([['GET', ''], ['GET', '/metadata'], ['POST', ''], ['DELETE', '']] as [$method, $suffix]) {
                self::assertSame($group === null ? 401 : 404, $this->request($method, $suffix)->getStatusCode());
            }
        }
    }

    public function testMutationsRequireCsrfProtection(): void
    {
        self::assertSame(403, $this->request('POST', '', ['revision' => '0'], OrderItemImageFixture::bytes(), false)->getStatusCode());
        self::assertSame(403, $this->request('DELETE', '', ['revision' => 0], null, false)->getStatusCode());
        self::assertSame(['revision' => 0, 'image' => null], $this->json($this->request('GET', '/metadata')));
    }

    private function request(string $method, string $suffix = '', array $body = [], ?string $bytes = null, bool $csrf = true): \Psr\Http\Message\ResponseInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $this->path . $suffix);
        if ($csrf) {
            $request = $request->withHeader('X-CSRF-Token', (new SessionService())->getCsrfToken());
        }
        if ($method === 'POST') {
            $request = $request->withParsedBody($body);
            if ($bytes !== null) {
                $request = $request->withUploadedFiles(['image' => OrderItemImageFixture::upload($bytes)]);
            }
        } elseif ($method === 'DELETE') {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, json_encode($body, JSON_THROW_ON_ERROR));
            rewind($stream);
            $request = $request->withBody(new Stream($stream))->withHeader('Content-Type', 'application/json');
        }
        return $this->app->handle($request);
    }

    private function json(\Psr\Http\Message\ResponseInterface $response): array
    {
        self::assertSame(200, $response->getStatusCode(), (string) $response->getBody());
        return json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
    }
}
