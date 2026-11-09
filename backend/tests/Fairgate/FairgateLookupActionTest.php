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

    public function testLookupPassesAnOptionalMembershipToTheProvider(): void
    {
        $receivedMembership = 'not-called';
        $action = new FairgateLookupAction(static function (string $email, ?string $membership) use (&$receivedMembership): array {
            self::assertSame('person@example.com', $email);
            $receivedMembership = $membership;

            return ['success' => true, 'data' => ['contactId' => 42]];
        });

        $response = $action(
            (new ServerRequestFactory())->createServerRequest(
                'GET',
                '/admin/fairgate-lookup?email=person%40example.com',
            ),
            new Response(),
        );

        self::assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(true, $body['fairgate']['success']);
        self::assertSame(42, $body['fairgate']['data']['contactId']);
        self::assertNull($receivedMembership);
    }
}
