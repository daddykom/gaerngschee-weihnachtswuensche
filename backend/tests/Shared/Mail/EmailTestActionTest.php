<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Shared\Mail\EmailTestAction;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class EmailTestActionTest extends TestCase
{
    public function testListsMailTemplatesAndTheirParameters(): void
    {
        $response = (new EmailTestAction())(
            (new ServerRequestFactory())->createServerRequest('GET', '/admin/email-test'),
            new Response(),
        );

        $body = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('client-order', $body['templates'][0]['id']);
        self::assertSame('loginUrl', $body['templates'][0]['fields'][0]['key']);
    }

    public function testRejectsInvalidEmailTestDataBeforeSending(): void
    {
        $request = (new ServerRequestFactory())
            ->createServerRequest('POST', '/admin/email-test')
            ->withHeader('Content-Type', 'application/json');
        $request->getBody()->write(json_encode([
            'recipient' => 'invalid',
            'template' => 'client-order',
            'parameters' => [],
        ], JSON_THROW_ON_ERROR));

        $response = (new EmailTestAction())($request, new Response());

        self::assertSame(422, $response->getStatusCode());
        self::assertSame(
            ['error' => ['code' => 'INVALID_EMAIL_TEST_DATA', 'details' => []]],
            json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR),
        );
    }
}
