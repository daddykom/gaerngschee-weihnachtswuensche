<?php

declare(strict_types=1);

namespace Tests\Routes;

use App\Auth\Services\SessionService;
use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\AdminStatisticsAction;
use App\Registration\Data\OrderStatisticsRepository;
use App\Routes\AdminRoutes;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class AdminStatisticsRoutesTest extends TestCase
{
    protected function setUp(): void
    {
        (new SessionService())->clear();
    }

    protected function tearDown(): void
    {
        (new SessionService())->clear();
    }

    #[DataProvider('roles')]
    public function testOnlyAdminsCanReadStatistics(?string $role, int $expectedStatus): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES ('year', 'campaign_year', '\"2026\"', '[\"admin\"]', '[\"admin\"]', 'Year')");
        $users = new UserRepository($pdo);
        if ($role !== null) {
            $user = $users->createUser('statistics-' . $role . '@example.com', 'secret', $role);
            (new SessionService())->setUser($user['id'], $role);
        }
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        AdminRoutes::register($app, userRepository: $users, adminStatisticsAction: new AdminStatisticsAction(new OrderStatisticsRepository($pdo), new FrontendConfigRepository($pdo)));
        $response = $app->handle((new ServerRequestFactory())->createServerRequest('GET', '/admin/statistics'));
        self::assertSame($expectedStatus, $response->getStatusCode());
        if ($expectedStatus === 200) {
            self::assertSame(2026, json_decode((string) $response->getBody(), true)['year']);
        }
    }

    public static function roles(): array
    {
        return [[null, 401], ['admin', 200], ['user', 404], ['wunschbesteller', 404], ['wunscherfueller', 404]];
    }
}
