<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Actions\FairgateLookupAction;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class FairgateLookupActionTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('APP_ENV');
        putenv('FSA_MODE');
    }

    public function testDefaultLookupUsesFakeProviderWhenFakeModeIsConfigured(): void
    {
        putenv('APP_ENV=test');
        putenv('FSA_MODE=fake');

        $response = (new FairgateLookupAction())(
            (new ServerRequestFactory())->createServerRequest(
                'GET',
                '/admin/fairgate-lookup?email=person%2Bfair1%40example.com&membership=Klient%2Ainnen',
            ),
            new Response(),
        );

        self::assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(true, $body['fairgate']['success']);
        self::assertSame(3, count(array_filter(
            $body['fairgate']['data'],
            static fn (mixed $value, int|string $key): bool => is_string($key)
                && str_starts_with($key, 'name_und_vorname_kind')
                && is_string($value)
                && trim($value) !== '',
            ARRAY_FILTER_USE_BOTH,
        )));
    }
}
