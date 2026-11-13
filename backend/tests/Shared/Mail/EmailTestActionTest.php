<?php

declare(strict_types=1);

namespace Tests\Shared\Mail;

use App\Shared\Mail\EmailTestAction;
use App\Shared\Mail\EmailSender;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Mailer\MailerInterface;
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
        $pickup = array_values(array_filter($body['templates'], static fn (array $template): bool => $template['id'] === 'order-ready-for-pickup'));
        self::assertCount(1, $pickup);
        self::assertSame(['year', 'orderNumber'], array_column($pickup[0]['fields'], 'key'));
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

    #[DataProvider('invalidPickupParameters')]
    public function testRejectsInvalidPickupParametersWithoutSending(array $parameters): void
    {
        $mailer = $this->createMock(MailerInterface::class);
        $mailer->expects(self::never())->method('send');
        $sender = new EmailSender($mailer, 'noreply@example.com', 'Gärngschee');
        $request = (new ServerRequestFactory())->createServerRequest('POST', '/admin/email-test')->withHeader('Content-Type', 'application/json');
        $request->getBody()->write(json_encode(['recipient' => 'test@example.com', 'template' => 'order-ready-for-pickup', 'parameters' => $parameters], JSON_THROW_ON_ERROR));
        self::assertSame(422, (new EmailTestAction($sender))($request, new Response())->getStatusCode());
    }

    public static function invalidPickupParameters(): array
    {
        return [[[]], [['year' => '2026']], [['year' => '2026', 'orderNumber' => '0']], [['year' => '-1', 'orderNumber' => '12']], [['year' => '2026', 'orderNumber' => '12.3']], [['year' => '2026', 'orderNumber' => str_repeat('9', 30)]], [['year' => true, 'orderNumber' => '12']]];
    }
}
