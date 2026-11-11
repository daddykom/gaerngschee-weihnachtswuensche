<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Data\FairgateContactRepository;
use App\Fairgate\Data\FairgateTokenRepository;
use Tests\Support\FairgateTestTokens;
use Tests\Support\TestDatabase;
use App\Shared\Database\Database;
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
    private FairgateTokenRepository $tokens;

    protected function setUp(): void
    {
        $this->tokens = FairgateTestTokens::repository();
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
            tokenRepository: $this->tokens,
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
        self::assertSame(FairgateTestTokens::token(), $history[2]['request']->getHeaderLine('Authorization'));
    }

    private function authentication(): Response
    {
        return FairgateTestTokens::response();
    }

    public function testNewClientInstanceReusesTokenFromDatabase(): void
    {
        $firstHistory = [];
        $this->client([$this->authentication(), new Response(200, [], '{"data":{"contactId":42}}')], $firstHistory)
            ->findContactDataById('42');
        $secondHistory = [];
        $this->client([new Response(200, [], '{"data":{"contactId":43}}')], $secondHistory)
            ->findContactDataById('43');

        self::assertCount(2, $firstHistory);
        self::assertCount(1, $secondHistory);
        self::assertSame('/fsa/v2.0/contact/org-123/data/43', $secondHistory[0]['request']->getUri()->getPath());
    }

    public function testUnauthorizedDataRequestRefreshesTokenAndRetriesOnlyOnce(): void
    {
        $history = [];
        $client = $this->client([
            $this->authentication(),
            new Response(401, [], '{"success":false}'),
            $this->authentication(),
            new Response(200, [], '{"data":{"contactId":42}}'),
        ], $history);

        self::assertSame(42, $client->findContactDataById('42')['data']['contactId']);
        self::assertCount(4, $history);
        self::assertSame('/fsa/v1.1/auth/refresh/org-123/token', $history[2]['request']->getUri()->getPath());
        self::assertSame(['refresh_token' => 'test-refresh-token'], json_decode((string) $history[2]['request']->getBody(), true));
    }

    public function testRepeatedUnauthorizedResponseDoesNotRefreshInALoop(): void
    {
        $history = [];
        $client = $this->client([
            $this->authentication(), new Response(401), $this->authentication(), new Response(401),
        ], $history);
        try {
            $client->findContactDataById('42');
            self::fail('The second unauthorized response must propagate.');
        } catch (FairgateException $exception) {
            self::assertSame(401, $exception->getCode());
            self::assertCount(4, $history);
        }
        $nextHistory = [];
        try {
            $this->client([], $nextHistory)->findContactDataById('42');
            self::fail('A repeated authorization failure must also block new client instances.');
        } catch (FairgateException $exception) {
            self::assertSame(429, $exception->getCode());
            self::assertSame([], $nextHistory);
        }
    }

    public function testForbiddenRefreshUsesOneNewAuthenticationAndReusesItsToken(): void
    {
        $history = [];
        $client = $this->client([
            $this->authentication(),
            new Response(401),
            new Response(403, [], '{"success":false,"message":"Refresh rejected"}'),
            $this->authentication(),
            new Response(200, [], '{"data":{"contactId":42}}'),
        ], $history);

        self::assertSame(42, $client->findContactDataById('42')['data']['contactId']);
        self::assertSame([
            '/fsa/v1.1/auth/create/org-123/token',
            '/fsa/v2.0/contact/org-123/data/42',
            '/fsa/v1.1/auth/refresh/org-123/token',
            '/fsa/v1.1/auth/create/org-123/token',
            '/fsa/v2.0/contact/org-123/data/42',
        ], array_map(static fn (array $entry): string => $entry['request']->getUri()->getPath(), $history));
        self::assertSame(['access_key' => 'access-key'], json_decode((string) $history[3]['request']->getBody(), true));
        $nextHistory = [];
        self::assertSame(43, $this->client([new Response(200, [], '{"data":{"contactId":43}}')], $nextHistory)
            ->findContactDataById('43')['data']['contactId']);
        self::assertCount(1, $nextHistory);
    }

    public function testAuthentication429StoresTheRetryHeaderWithoutSendingDataRequests(): void
    {
        $history = [];
        $client = $this->client([new Response(429, ['X-RateLimit-Retry-After' => '120'], '{"success":false}')], $history);
        try {
            $client->findContactDataById('42');
            self::fail('Authentication must be blocked.');
        } catch (FairgateException $exception) {
            self::assertSame(429, $exception->getCode());
            self::assertSame(120, $exception->retryAfter);
            self::assertCount(1, $history);
        }
        $nextHistory = [];
        try {
            $this->client([], $nextHistory)->findContactDataById('43');
            self::fail('The cooldown must survive a new client instance.');
        } catch (FairgateException $exception) {
            self::assertSame(429, $exception->getCode());
            self::assertSame([], $nextHistory);
        }
    }

    #[DataProvider('retryHeaders')]
    public function testData429StoresCooldownWithoutRefreshingOrCreatingTokens(array $headers, int $expectedWait): void
    {
        $history = [];
        try {
            $this->client([$this->authentication(), new Response(429, $headers, '{"success":false}')], $history)
                ->findContactDataById('42');
            self::fail('The rate limit must propagate.');
        } catch (FairgateException $exception) {
            self::assertSame($expectedWait, $exception->retryAfter);
            self::assertCount(2, $history);
        }
        $nextHistory = [];
        try {
            $this->client([], $nextHistory)->fetchAllClientContacts();
            self::fail('All data endpoints must respect the cooldown.');
        } catch (FairgateException $exception) {
            self::assertSame(429, $exception->getCode());
            self::assertSame([], $nextHistory);
        }
    }

    public static function retryHeaders(): array
    {
        return [
            [['X-RateLimit-Retry-After' => '120'], 120],
            [['Retry-After' => '60'], 60],
            [[], 300],
            [['X-RateLimit-Retry-After' => 'invalid'], 300],
        ];
    }

    public function testAuthenticationErrorLogsNeverContainCredentialResponseBodies(): void
    {
        $pdo = TestDatabase::create();
        $property = new \ReflectionProperty(Database::class, 'pdo');
        $previous = $property->getValue();
        $property->setValue(null, $pdo);
        try {
            $history = [];
            try {
                $this->client([new Response(401, [], '{"token":"secret-access","refresh_token":"secret-refresh","access_key":"secret-key"}')], $history)
                    ->findContactDataById('42');
                self::fail('Authentication must fail.');
            } catch (FairgateException $exception) {
                self::assertStringNotContainsString('secret-', $exception->getMessage());
            }
            $logs = $pdo->query('SELECT * FROM external_error_logs')->fetchAll(PDO::FETCH_ASSOC);
            self::assertCount(1, $logs);
            self::assertNull($logs[0]['details']);
            self::assertStringNotContainsString('secret-', json_encode($logs, JSON_THROW_ON_ERROR));
        } finally {
            $property->setValue(null, $previous);
        }
    }

    #[DataProvider('contactListRetryHeaders')]
    public function testDailyContactListQuotaDoesNotBlockExtendedDataRequests(array $headers, int $expectedWait): void
    {
        $history = [];
        try {
            $this->client([$this->authentication(), new Response(429, ['X-RateLimit-Limit' => '1', ...$headers])], $history)
                ->fetchAllClientContacts();
            self::fail('The list quota must stop the import.');
        } catch (FairgateException $exception) {
            self::assertSame($expectedWait, $exception->retryAfter);
        }
        $dataHistory = [];
        self::assertSame(42, $this->client([new Response(200, [], '{"data":{"contactId":42}}')], $dataHistory)
            ->findContactDataById('42')['data']['contactId']);
        self::assertCount(1, $dataHistory);
        $nextHistory = [];
        try {
            $this->client([], $nextHistory)->fetchAllClientContacts();
            self::fail('The list quota must still be active.');
        } catch (FairgateException $exception) {
            self::assertSame(429, $exception->getCode());
            self::assertSame([], $nextHistory);
        }
    }

    public static function contactListRetryHeaders(): array
    {
        return [[['X-RateLimit-Retry-After' => '36000'], 36000], [[], 86400]];
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
            static fn (string $token): bool => $token === FairgateTestTokens::token(),
            $contacts ?? $this->contacts,
            $this->tokens,
        );
    }
}
