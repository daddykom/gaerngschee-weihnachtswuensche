<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Actions\ReceiveGiftAction;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class ReceiveGiftActionTest extends TestCase
{
    public function testRejectsInvalidNumberBeforeAccessingTheDatabase(): void
    {
        $response = (new ReceiveGiftAction())((new ServerRequestFactory())->createServerRequest('POST', '/'), new Response(), ['giftNumber' => '0-1']);
        self::assertSame(400, $response->getStatusCode());
        self::assertSame('INVALID_GIFT_NUMBER', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    public function testRequiresBooleanConfirmationFlags(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest('POST', '/');
        $request->getBody()->write('{"confirmUnreserved":"true","confirmPickup":true}');
        $response = (new ReceiveGiftAction())($request, new Response(), ['giftNumber' => '12-1']);
        self::assertSame(422, $response->getStatusCode());
    }
}
