<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Actions\PickupQrCodeAction;
use App\Registration\Services\PickupCodeService;
use App\Registration\Services\QrCodeGenerator;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class PickupQrCodeActionTest extends TestCase
{
    public function testRendersTheSamePngAsTheEmbeddedImageWithoutLoggingInOrChangingData(): void
    {
        $codes = new PickupCodeService('https://wishes.example', 'https://api.example');
        $code = $codes->create();
        $generator = new QrCodeGenerator();
        $embedded = $generator->generateDataUri($code['pickupUrl']);
        $response = (new PickupQrCodeAction($codes, $generator))(
            (new ServerRequestFactory())->createServerRequest('GET', '/public/pickup-qr-code/' . $code['token']),
            new Response(),
            ['token' => $code['token']],
        );
        $png = (string) $response->getBody();
        self::assertSame(200, $response->getStatusCode());
        self::assertSame('image/png', $response->getHeaderLine('Content-Type'));
        self::assertSame('private, no-store', $response->getHeaderLine('Cache-Control'));
        self::assertSame('no-referrer', $response->getHeaderLine('Referrer-Policy'));
        self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        self::assertStringStartsWith("\x89PNG\r\n\x1a\n", $png);
        self::assertSame($embedded, 'data:image/png;base64,' . base64_encode($png));
        $size = getimagesizefromstring($png);
        self::assertIsArray($size);
        self::assertSame($size[0], $size[1]);
        self::assertGreaterThanOrEqual(300, $size[0]);
    }

    public function testMalformedTokensAreNotAcceptedAsQrPayloads(): void
    {
        $response = (new PickupQrCodeAction())((new ServerRequestFactory())->createServerRequest('GET', '/'), new Response(), ['token' => 'https://attacker.example']);
        self::assertSame(404, $response->getStatusCode());
        self::assertSame('NOT_FOUND', json_decode((string) $response->getBody(), true)['error']['code']);
    }
}
