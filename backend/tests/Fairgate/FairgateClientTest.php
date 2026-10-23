<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Services\FairgateClient;
use App\Fairgate\Services\FairgateException;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

final class FairgateClientTest extends TestCase
{
    public function testHasContactByEmailAuthenticatesAndReturnsTrueWhenFound(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(
                200,
                [],
                '{"success":true,"data":{"contacts":[{"basefields":{"contact_id":42},"status":"active","communication":{"primary_email":"person@example.com"}}]}}',
            ),
        ]));
        $handler->push(Middleware::history($history));

        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => $token === 'test-token',
        );

        self::assertTrue($client->hasContactByEmail(' Person@Example.com '));
        self::assertCount(2, $history);
        self::assertSame('/fsa/v1.1/auth/create/org-123/token', $history[0]['request']->getUri()->getPath());
        self::assertSame('/fsa/v1.1/contact/org-123/contacts/list', $history[1]['request']->getUri()->getPath());
        self::assertSame('test-token', $history[1]['request']->getHeaderLine('Authorization'));
    }

    public function testFindContactDataByEmailLoadsTheExtendedContactData(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(
                200,
                [],
                '{"success":true,"data":{"contacts":[{"contact_id":42,"primary_email":"person@example.com"}]}}',
            ),
            new Response(
                200,
                [],
                '{"success":true,"code":200,"data":{"contactId":42,"custom_field":"value"}}',
            ),
        ]));
        $handler->push(Middleware::history($history));

        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => $token === 'test-token',
        );

        self::assertSame(
            ['contactId' => 42, 'custom_field' => 'value'],
            $client->findContactDataByEmail('person@example.com')['data'],
        );
        self::assertSame('/fsa/v2.0/contact/org-123/data/42', $history[2]['request']->getUri()->getPath());
    }

    public function testFindContactDataByEmailPassesMembershipFilter(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(200, [], '{"success":true,"data":{"contacts":[]}}'),
        ]));
        $handler->push(Middleware::history($history));

        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => $token === 'test-token',
        );

        $client->findContactDataByEmail('person@example.com', 'Aktivmitglied');

        self::assertSame(
            'pageNo=1&pageLimit=1&primary_email=person%40example.com&membership%5B%5D=Aktivmitglied',
            $history[1]['request']->getUri()->getQuery(),
        );
    }

    public function testFindAllContactsLoadsEmailAndContactIdWithoutEmailFilter(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(200, [], '{"success":true,"data":{"contacts":[{"contact_id":42,"primary_email":"person@example.com"},{"basefields":{"contact_id":43},"communication":{"primary_email":"other@example.com"}}]}}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => $token === 'test-token',
        );

        self::assertSame([
            ['email' => 'person@example.com', 'contactId' => '42'],
            ['email' => 'other@example.com', 'contactId' => '43'],
        ], $client->findAllContacts());
    }

    public function testHasContactByEmailReturnsFalseWhenContactIsNotFound(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(200, [], '{"success":true,"data":{"contacts":[]}}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        self::assertFalse($client->hasContactByEmail('missing@example.com'));
    }

    public function testInvalidAuthenticationResponseThrowsFairgateException(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(401, [], '{"success":false}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        $this->expectException(FairgateException::class);
        $client->hasContactByEmail('person@example.com');
    }

    public function testAuthenticationWithUnsuccessfulResponseThrowsFairgateException(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":false}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        $this->expectException(FairgateException::class);
        $client->hasContactByEmail('person@example.com');
    }

    public function testAuthenticationWithInvalidTokenThrowsFairgateException(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"invalid-token"}}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
        );

        $this->expectException(FairgateException::class);
        $client->hasContactByEmail('person@example.com');
    }

    public function testEmptyEmailDoesNotCallFairgate(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(500),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        self::assertFalse($client->hasContactByEmail('   '));
    }

    public function testInvalidContactJsonThrowsFairgateException(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{invalid-json'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        $this->expectException(FairgateException::class);
        $client->hasContactByEmail('person@example.com');
    }

    public function testContactHttpErrorThrowsFairgateException(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(500, [], '{"success":false}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        $this->expectException(FairgateException::class);
        $client->hasContactByEmail('person@example.com');
    }

    public function testBearerTokenIsReusedForSubsequentRequests(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"test-token"}}'),
            new Response(200, [], '{"success":true,"data":{"contacts":[]}}'),
            new Response(200, [], '{"success":true,"data":{"contacts":[]}}'),
        ]));
        $history = [];
        $handler->push(Middleware::history($history));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => true,
        );

        self::assertFalse($client->hasContactByEmail('first@example.com'));
        self::assertFalse($client->hasContactByEmail('second@example.com'));
        self::assertCount(3, $history);
    }
}
