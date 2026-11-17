<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\AdminStatisticsAction;
use App\Registration\Data\OrderRepository;
use App\Registration\Data\OrderStatisticsRepository;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\TestDatabase;

final class AdminStatisticsActionTest extends TestCase
{
    public function testUsesTheConfiguredYearAndIgnoresListFiltersAndYearQueryParameters(): void
    {
        $pdo = TestDatabase::create();
        $pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES ('year', 'campaign_year', '\"2042\"', '[\"admin\"]', '[\"admin\"]', 'Year')");
        $user = (new UserRepository($pdo))->createUser('statistics@example.com', 'secret', 'wunschbesteller');
        (new OrderRepository($pdo))->saveForYear($user['id'], 2042, 'draft', 1, 0, []);
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/admin/statistics')->withQueryParams(['year' => '2026', 'status' => ['definitive'], 'category' => ['gift']]);
        $response = (new AdminStatisticsAction(new OrderStatisticsRepository($pdo), new FrontendConfigRepository($pdo)))($request, new Response());
        self::assertSame(200, $response->getStatusCode());
        self::assertSame([
            'year' => 2042, 'orderCount' => 1, 'wishCount' => 0, 'availableCount' => 0,
            'pendingConfirmationCount' => 0, 'reservedCount' => 0, 'receivedCount' => 0, 'completedCount' => 0,
        ], json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR));
    }

    public function testReturnsAStandardErrorWhenTheCampaignYearIsMissing(): void
    {
        $pdo = TestDatabase::create();
        $response = (new AdminStatisticsAction(new OrderStatisticsRepository($pdo), new FrontendConfigRepository($pdo)))((new ServerRequestFactory())->createServerRequest('GET', '/admin/statistics'), new Response());
        self::assertSame(500, $response->getStatusCode());
        self::assertSame(['error' => ['code' => 'STATISTICS_LOAD_FAILED', 'details' => []]], json_decode((string) $response->getBody(), true));
    }
}
