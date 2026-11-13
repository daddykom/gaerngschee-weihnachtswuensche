<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Auth\Services\SessionService;
use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\GiftReceiptLookupAction;
use App\Registration\Actions\ReceiveGiftAction;
use App\Registration\Services\GiftReceiptService;
use Tests\Support\RecordingEmailSender;
use App\Registration\Data\GiftReceiptRepository;
use App\Routes\UserRoutes;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class GiftReceiptRoutesTest extends TestCase
{
    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    #[DataProvider('accessGroups')]
    public function testLookupIsAvailableOnlyToStaffAndAdmins(?string $group, int $status, string $code): void
    {
        (new SessionService())->clear();
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
            VALUES ('year', 'campaign_year', '\"2035\"', '[]', '[]', 'Year')");
        $users = new UserRepository($pdo);
        if ($group !== null) {
            $user = $users->createUser($group . '@example.com', 'secret', $group);
            (new SessionService())->setUser($user['id'], $group);
        }
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        $config = new FrontendConfigRepository($pdo);
        $receipts = new GiftReceiptRepository($pdo);
        $service = new GiftReceiptService($receipts, new RecordingEmailSender(), static fn (): array => []);
        UserRoutes::register($app, $users, null, new GiftReceiptLookupAction($receipts, $config), new ReceiveGiftAction($service, $config));
        foreach (['GET', 'POST'] as $method) {
            $response = $app->handle((new ServerRequestFactory())->createServerRequest($method, '/user/gift-receipts/12-1'));
            self::assertSame($status, $response->getStatusCode());
            self::assertSame($code, json_decode((string) $response->getBody(), true)['error']['code']);
        }
    }

    public static function accessGroups(): array
    {
        return [
            ['admin', 404, 'GIFT_NOT_FOUND'],
            ['user', 404, 'GIFT_NOT_FOUND'],
            ['wunschbesteller', 404, 'NOT_FOUND'],
            ['wunscherfueller', 404, 'NOT_FOUND'],
            [null, 401, 'SESSION_EXPIRED'],
        ];
    }
}
