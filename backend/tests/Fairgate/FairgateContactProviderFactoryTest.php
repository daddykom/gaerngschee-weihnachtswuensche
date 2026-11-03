<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Services\FakeFairgateClient;
use App\Fairgate\Services\FairgateClient;
use App\Fairgate\Services\FairgateContactProviderFactory;
use LogicException;
use PHPUnit\Framework\TestCase;

final class FairgateContactProviderFactoryTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('APP_ENV');
        putenv('FSA_MODE');
    }

    public function testTestEnvironmentUsesFakeClient(): void
    {
        self::assertInstanceOf(FakeFairgateClient::class, FairgateContactProviderFactory::create(['mode' => 'fake']));
    }

    public function testConfiguredFakeModeIsUsedByTheDefaultFactory(): void
    {
        putenv('APP_ENV=test');
        putenv('FSA_MODE=fake');

        self::assertInstanceOf(FakeFairgateClient::class, FairgateContactProviderFactory::create());
    }

    public function testProductionEnvironmentUsesRealClient(): void
    {
        self::assertInstanceOf(FairgateClient::class, FairgateContactProviderFactory::create([
            'mode' => 'real',
            'base_url' => 'https://example.test',
            'organization_id' => 'org',
            'access_key' => 'access',
            'public_key' => 'public',
        ]));
    }

    public function testCreateRealAlwaysUsesRealClient(): void
    {
        self::assertInstanceOf(FairgateClient::class, FairgateContactProviderFactory::createReal([
            'mode' => 'fake',
            'base_url' => 'https://example.test',
            'organization_id' => 'org',
            'access_key' => 'access',
            'public_key' => 'public',
        ]));
    }

    public function testUnknownEnvironmentIsRejected(): void
    {
        $this->expectException(LogicException::class);
        FairgateContactProviderFactory::create(['mode' => 'unknown']);
    }
}
