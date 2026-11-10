<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Data\FairgateContactRepository;
use App\Fairgate\Services\FairgateClient;
use App\Fairgate\Services\FairgateException;
use DateTimeImmutable;
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use InvalidArgumentException;
use PDO;
use PDOException;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261110134342_create_fairgate_contacts_table.php';

final class FairgateClientTest extends TestCase
{
    private FairgateContactRepository $contacts;

    protected function setUp(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($pdo);
        $migration = new \CreateFairgateContactsTable('development', 20261110134342);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $this->contacts = new FairgateContactRepository($pdo);
        $this->contacts->upsert('42', 'person@example.com', new DateTimeImmutable('2026-11-10 10:00:00'));
    }

    public function testHasContactByEmailUsesLocalMappingWithoutHttpRequests(): void
    {
        $history = [];
        $client = $this->client([], $history);

        self::assertTrue($client->hasContactByEmail(' Person@Example.com ', 'Klient*innen'));
        self::assertFalse($client->hasContactByEmail('missing@example.com', 'Klient*innen'));
        self::assertSame([], $history);
    }

    public function testEmailLookupRequestsOnlyAuthenticationAndExtendedDataForLocalId(): void
    {
        $history = [];
        $client = $this->client([
            $this->authentication(),
            new Response(200, [], '{"success":true,"code":200,"data":{"contactId":42,"custom_field":"value"}}'),
        ], $history);

        self::assertSame(['contactId' => 42, 'custom_field' => 'value'], $client->findContactDataByEmail(' Person@Example.com ', 'Klient*innen')['data']);
        self::assertCount(2, $history);
        self::assertSame('/fsa/v1.1/auth/create/org-123/token', $history[0]['request']->getUri()->getPath());
        self::assertSame('/fsa/v2.0/contact/org-123/data/42', $history[1]['request']->getUri()->getPath());
        self::assertSame('', $history[1]['request']->getUri()->getQuery());
    }

    public function testMissingLocalMappingReturnsNullWithoutRemoteFallback(): void
    {
        $history = [];
        $client = $this->client([], $history);

        self::assertSame(['success' => true, 'code' => 200, 'data' => null], $client->findContactDataByEmail('missing@example.com', 'Klient*innen'));
        self::assertSame([], $history);
    }

    public function testMembershipCanBeOmittedForLocalClientMapping(): void
    {
        $history = [];
        $client = $this->client([
            $this->authentication(),
            new Response(200, [], '{"success":true,"data":{"contactId":42}}'),
        ], $history);

        self::assertSame(['contactId' => 42], $client->findContactDataByEmail('person@example.com')['data']);
        self::assertCount(2, $history);
    }

    public function testOtherMembershipCannotUseClientMapping(): void
    {
        $history = [];
        $client = $this->client([], $history);

        $this->expectException(InvalidArgumentException::class);
        $client->findContactDataByEmail('person@example.com', 'Aktivmitglied');
    }

    public function testEmptyEmailDoesNotAccessDatabaseOrFairgate(): void
    {
        $history = [];
        $client = $this->client([], $history, new FairgateContactRepository(new PDO('sqlite::memory:')));

        self::assertFalse($client->hasContactByEmail('   ', 'Klient*innen'));
        self::assertNull($client->findContactDataByEmail('')['data']);
        self::assertSame([], $history);
    }

    #[DataProvider('lookupMethods')]
    public function testLocalDatabaseFailureIsNotTreatedAsMissingContact(string $method): void
    {
        $history = [];
        $client = $this->client([], $history, new FairgateContactRepository(new PDO('sqlite::memory:')));

        try {
            $client->$method('person@example.com', 'Klient*innen');
            self::fail('A database error must propagate as a Fairgate error.');
        } catch (FairgateException $exception) {
            self::assertSame('Local Fairgate contact lookup failed.', $exception->getMessage());
            self::assertInstanceOf(PDOException::class, $exception->getPrevious());
            self::assertSame([], $history);
        }
    }

    public static function lookupMethods(): array
    {
        return [['hasContactByEmail'], ['findContactDataByEmail']];
    }

    #[DataProvider('authenticationFailures')]
    public function testAuthenticationFailureThrowsFairgateException(Response $response): void
    {
        $history = [];
        $client = $this->client([$response], $history);

        $this->expectException(FairgateException::class);
        $client->findContactDataByEmail('person@example.com', 'Klient*innen');
    }

    public static function authenticationFailures(): array
    {
        return [
            'HTTP error' => [new Response(401, [], '{"success":false}')],
            'unsuccessful response' => [new Response(200, [], '{"success":false}')],
            'invalid token' => [new Response(200, [], '{"success":true,"data":{"token":"invalid-token"}}')],
            'invalid JSON' => [new Response(200, [], '{invalid-json')],
        ];
    }

    public function testInvalidJwtIsRejectedByDefaultValidator(): void
    {
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"success":true,"data":{"token":"invalid-token"}}'),
        ]));
        $client = new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch']),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            contacts: $this->contacts,
        );

        $this->expectException(FairgateException::class);
        $client->findContactDataByEmail('person@example.com', 'Klient*innen');
    }

    #[DataProvider('extendedDataFailures')]
    public function testExtendedDataErrorDoesNotTriggerContactSearch(Response $response): void
    {
        $history = [];
        $client = $this->client([$this->authentication(), $response], $history);

        try {
            $client->findContactDataByEmail('person@example.com', 'Klient*innen');
            self::fail('The extended-data error must propagate.');
        } catch (FairgateException) {
            self::assertCount(2, $history);
            self::assertSame('/fsa/v2.0/contact/org-123/data/42', $history[1]['request']->getUri()->getPath());
        }
    }

    public static function extendedDataFailures(): array
    {
        return [
            'invalid JSON' => [new Response(200, [], '{invalid-json')],
            'HTTP error' => [new Response(500, [], '{"success":false}')],
            'removed Fairgate contact' => [new Response(404, [], '{"success":false}')],
            'rate limit' => [new Response(429, [], '{"success":false}')],
            'unsuccessful response' => [new Response(200, [], '{"success":false}')],
        ];
    }

    public function testBearerTokenIsReusedForSubsequentExtendedDataRequests(): void
    {
        $history = [];
        $client = $this->client([
            $this->authentication(),
            new Response(200, [], '{"success":true,"data":{"contactId":42}}'),
            new Response(200, [], '{"success":true,"data":{"contactId":42}}'),
        ], $history);

        self::assertSame(42, $client->findContactDataByEmail('person@example.com')['data']['contactId']);
        self::assertSame(42, $client->findContactDataByEmail('person@example.com')['data']['contactId']);
        self::assertCount(3, $history);
        self::assertSame('test-token', $history[2]['request']->getHeaderLine('Authorization'));
    }

    private function authentication(): Response
    {
        return new Response(200, [], '{"success":true,"data":{"token":"test-token"}}');
    }

    private function client(array $responses, array &$history, ?FairgateContactRepository $contacts = null): FairgateClient
    {
        $handler = HandlerStack::create(new MockHandler($responses));
        $handler->push(Middleware::history($history));

        return new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch', 'http_errors' => false]),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => $token === 'test-token',
            $contacts ?? $this->contacts,
        );
    }
}
