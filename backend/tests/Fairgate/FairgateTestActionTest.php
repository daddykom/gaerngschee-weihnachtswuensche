<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Actions\FairgateTestAction;
use App\Configuration\Data\FrontendConfigRepository;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;
use Slim\Psr7\Factory\ServerRequestFactory;
use Tests\Support\TestDatabase;

final class FairgateTestActionTest extends TestCase
{
    public function testReturnsExtendedFairgateDataForConfiguredTestContact(): void
    {
        $action = new FairgateTestAction(static fn (string $email, string $membership): array => [
            'success' => true,
            'data' => ['contactId' => 42, 'email' => $email],
        ], $this->configRepository());

        $response = ($action)(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/fairgate/test'),
            new Response(),
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(
            [
                'email' => 'isabelle.joss@gaerngschee.ch',
                'fairgate' => [
                    'success' => true,
                    'data' => [
                        'contactId' => 42,
                        'email' => 'isabelle.joss@gaerngschee.ch',
                    ],
                ],
            ],
            json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR),
        );
    }

    public function testReturnsBadGatewayWhenFairgateRequestFails(): void
    {
        $action = new FairgateTestAction(static function (string $email, string $membership): array {
            throw new \App\Fairgate\Services\FairgateException('FSA unavailable.');
        }, $this->configRepository());

        $response = ($action)(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/fairgate/test'),
            new Response(),
        );

        self::assertSame(502, $response->getStatusCode());
        self::assertSame(
            ['error' => ['code' => 'FAIRGATE_TEST_FAILED', 'details' => []]],
            json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR),
        );
    }

    private function configRepository(): FrontendConfigRepository
    {
        $pdo = TestDatabase::create();
        $statement = $pdo->prepare(
            'INSERT INTO frontend_config
                (id, variable_name, value, description, access_group, update_group, label)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([
            'config-1', 'fairgate_test_email', '"isabelle.joss@gaerngschee.ch"',
            'Test', '["admin"]', '["admin"]', 'Fairgate Test E-Mail',
        ]);

        return new FrontendConfigRepository($pdo);
    }
}
