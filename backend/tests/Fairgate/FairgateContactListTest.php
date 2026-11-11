<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Services\FairgateClient;
use App\Fairgate\Services\FairgateException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FairgateTestTokens;

final class FairgateContactListTest extends TestCase
{
    public function testReadsEveryClientMembershipPageAndNormalizesBothContactFormats(): void
    {
        $history = [];
        $client = $this->client([
            $this->page([['contact_id' => 42, 'primary_email' => ' First@Example.com ']], 1, 2, 2),
            $this->page([['basefields' => ['contact_id' => '43'], 'communication' => ['primary_email' => 'SECOND@example.com']]], 2, 2, 2),
        ], $history);

        self::assertSame([
            ['email' => 'first@example.com', 'fairgate_contact_id' => '42'],
            ['email' => 'second@example.com', 'fairgate_contact_id' => '43'],
        ], $client->fetchAllClientContacts());

        self::assertCount(3, $history);
        foreach ([1, 2] as $page) {
            $request = $history[$page]['request'];
            self::assertSame('/fsa/v1.1/contact/org-123/contacts', $request->getUri()->getPath());
            self::assertSame('pageNo=' . $page . '&pageLimit=100&membership%5B%5D=Klient%2Ainnen', $request->getUri()->getQuery());
            self::assertSame(FairgateTestTokens::token(), $request->getHeaderLine('Authorization'));
        }
    }

    #[DataProvider('emptyPageCounts')]
    public function testAcceptsAnExplicitlyEmptyMembership(int $totalPages): void
    {
        $history = [];
        $client = $this->client([$this->page([], 1, $totalPages, 0)], $history);

        self::assertSame([], $client->fetchAllClientContacts());
        self::assertCount(2, $history);
    }

    public static function emptyPageCounts(): array
    {
        return [[0], [1]];
    }

    public function testDoesNotRequireOptionalPageNumberAndRecordCount(): void
    {
        $history = [];
        $client = $this->client([new Response(200, [], '{"success":true,"data":{"contacts":[{"contact_id":42,"primary_email":"person@example.com"}],"totalPages":"1"}}')], $history);

        self::assertSame([['email' => 'person@example.com', 'fairgate_contact_id' => '42']], $client->fetchAllClientContacts());
    }

    #[DataProvider('invalidResponses')]
    public function testRejectsInvalidResponses(array $data): void
    {
        $history = [];
        $client = $this->client([new Response(200, [], json_encode(['success' => true, 'data' => $data], JSON_THROW_ON_ERROR))], $history);

        $this->expectException(FairgateException::class);
        $client->fetchAllClientContacts();
    }

    public static function invalidResponses(): array
    {
        $contact = ['contact_id' => 42, 'primary_email' => 'person@example.com'];

        return [
            'missing contacts' => [['totalPages' => 1]],
            'missing pagination' => [['contacts' => [$contact]]],
            'invalid pagination' => [['contacts' => [$contact], 'totalPages' => 'invalid']],
            'negative pagination' => [['contacts' => [$contact], 'totalPages' => -1]],
            'zero pages with contacts' => [['contacts' => [$contact], 'totalPages' => 0]],
            'wrong page number' => [['contacts' => [$contact], 'totalPages' => 1, 'pageNo' => 2]],
            'empty non-final page' => [['contacts' => [], 'totalPages' => 2]],
            'non-list contacts' => [['contacts' => ['unexpected' => $contact], 'totalPages' => 1]],
            'invalid contact' => [['contacts' => [null], 'totalPages' => 1]],
            'missing email' => [['contacts' => [['contact_id' => 42]], 'totalPages' => 1]],
            'missing ID' => [['contacts' => [['primary_email' => 'person@example.com']], 'totalPages' => 1]],
            'invalid email' => [['contacts' => [['contact_id' => 42, 'primary_email' => 'invalid']], 'totalPages' => 1]],
            'invalid email type' => [['contacts' => [['contact_id' => 42, 'primary_email' => []]], 'totalPages' => 1]],
            'invalid ID type' => [['contacts' => [['contact_id' => [], 'primary_email' => 'person@example.com']], 'totalPages' => 1]],
            'empty ID' => [['contacts' => [['contact_id' => '', 'primary_email' => 'person@example.com']], 'totalPages' => 1]],
            'ID with whitespace' => [['contacts' => [['contact_id' => ' 42 ', 'primary_email' => 'person@example.com']], 'totalPages' => 1]],
            'overlong ID' => [['contacts' => [['contact_id' => str_repeat('1', 256), 'primary_email' => 'person@example.com']], 'totalPages' => 1]],
            'invalid count' => [['contacts' => [$contact], 'totalPages' => 1, 'totalRecords' => 'invalid']],
            'incomplete list' => [['contacts' => [$contact], 'totalPages' => 1, 'totalRecords' => 2]],
            'duplicate IDs' => [['contacts' => [$contact, ['contact_id' => 42, 'primary_email' => 'other@example.com']], 'totalPages' => 1]],
            'duplicate emails' => [['contacts' => [$contact, ['contact_id' => 43, 'primary_email' => ' PERSON@example.com ']], 'totalPages' => 1]],
        ];
    }

    #[DataProvider('inconsistentSecondPages')]
    public function testRejectsInconsistentLaterPages(array $secondPage): void
    {
        $history = [];
        $client = $this->client([
            $this->page([['contact_id' => 42, 'primary_email' => 'first@example.com']], 1, 2, 2),
            new Response(200, [], json_encode(['success' => true, 'data' => $secondPage], JSON_THROW_ON_ERROR)),
        ], $history);

        $this->expectException(FairgateException::class);
        $client->fetchAllClientContacts();
    }

    public static function inconsistentSecondPages(): array
    {
        $contact = ['contact_id' => 43, 'primary_email' => 'second@example.com'];

        return [
            'changed page count' => [['contacts' => [$contact], 'totalPages' => 3]],
            'changed record count' => [['contacts' => [$contact], 'totalPages' => 2, 'totalRecords' => 3]],
            'empty final page' => [['contacts' => [], 'totalPages' => 2]],
            'repeated page' => [['contacts' => [$contact], 'totalPages' => 2, 'pageNo' => 1]],
            'duplicate across pages' => [['contacts' => [['contact_id' => 42, 'primary_email' => 'first@example.com']], 'totalPages' => 2]],
        ];
    }

    #[DataProvider('failedSecondPages')]
    public function testLaterPageFailureThrowsInsteadOfReturningPartialContacts(Response|ConnectException $failure): void
    {
        $history = [];
        $client = $this->client([
            $this->page([['contact_id' => 42, 'primary_email' => 'first@example.com']], 1, 2, 2),
            $failure,
        ], $history);

        $this->expectException(FairgateException::class);
        $client->fetchAllClientContacts();
    }

    public static function failedSecondPages(): array
    {
        return [
            'rate limit' => [new Response(429, [], '{"success":false}')],
            'server error' => [new Response(503, [], '{"success":false}')],
            'unsuccessful response' => [new Response(200, [], '{"success":false}')],
            'invalid JSON' => [new Response(200, [], '{invalid-json')],
            'network error' => [new ConnectException('Connection failed', new Request('GET', 'https://fairgate.example/contacts'))],
        ];
    }

    private function page(array $contacts, int $page, int $totalPages, int $totalRecords): Response
    {
        return new Response(200, [], json_encode([
            'success' => true,
            'data' => ['contacts' => $contacts, 'pageNo' => $page, 'totalPages' => $totalPages, 'totalRecords' => $totalRecords],
        ], JSON_THROW_ON_ERROR));
    }

    private function client(array $responses, array &$history): FairgateClient
    {
        $handler = HandlerStack::create(new MockHandler([
            FairgateTestTokens::response(),
            ...$responses,
        ]));
        $handler->push(Middleware::history($history));

        return new FairgateClient(
            new Client(['handler' => $handler, 'base_uri' => 'https://fsa-test.fairgate.ch', 'http_errors' => false]),
            'https://fsa-test.fairgate.ch',
            'org-123',
            'access-key',
            null,
            static fn (string $token): bool => $token === FairgateTestTokens::token(),
            tokenRepository: FairgateTestTokens::repository(),
        );
    }
}
