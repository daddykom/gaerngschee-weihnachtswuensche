<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use App\Shared\Logging\ExternalErrorLogger;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Ecdsa\Sha512;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Validator;
use Psr\Http\Client\ClientInterface;

final class FairgateClient implements FairgateContactProvider, FairgateBatchContactProvider
{
    private const CONTACTS_PATH = '/fsa/v1.1/contact/%s/contacts';
    private const FILTERED_CONTACTS_PATH = '/fsa/v1.1/contact/%s/contacts/list';
    private const CONTACT_DATA_PATH = '/fsa/v2.0/contact/%s/data/%s';
    private const TOKEN_PATH = '/fsa/v1.1/auth/create/%s/token';

    private ?string $bearerToken = null;

    /**
     * @param callable(string): bool|null $tokenValidator
     */
    public function __construct(
        private readonly ?ClientInterface $httpClient = null,
        private readonly ?string $baseUrl = null,
        private readonly ?string $organizationId = null,
        private readonly ?string $accessKey = null,
        private readonly ?string $publicKey = null,
        ?callable $tokenValidator = null,
    ) {
        $this->tokenValidator = $tokenValidator ?? $this->validateToken(...);
    }

    /** @var callable(string): bool */
    private $tokenValidator;

    public function hasContactByEmail(string $email): bool
    {
        $data = $this->findContactsByEmail($email);
        $contacts = $data['data']['contacts'] ?? [];

        foreach ($contacts as $contact) {
            $contactEmail = strtolower(trim((string) ($contact['communication']['primary_email'] ?? '')));
            if ($contactEmail === strtolower(trim($email))) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, mixed> */
    public function findContactsByEmail(string $email, ?string $membership = null): array
    {
        $email = strtolower(trim($email));
        if ($email === '') {
            return ['success' => true, 'data' => ['contacts' => []]];
        }

        return $this->requestContacts($email, 1, 1, $membership);
    }

    /** @return list<array{email: string, contactId: string}> */
    public function findAllContacts(): array
    {
        $contacts = [];
        $page = 1;
        $pageLimit = 100;

        do {
            $data = $this->requestContacts(null, $page, $pageLimit);
            $pageContacts = $data['data']['contacts'] ?? [];
            if (!is_array($pageContacts)) {
                break;
            }

            foreach ($pageContacts as $contact) {
                if (!is_array($contact)) {
                    continue;
                }
                $email = strtolower(trim((string) ($contact['primary_email'] ?? $contact['communication']['primary_email'] ?? '')));
                $contactId = $contact['contact_id'] ?? $contact['basefields']['contact_id'] ?? null;
                if ($email !== '' && $contactId !== null) {
                    $contacts[] = ['email' => $email, 'contactId' => (string) $contactId];
                }
            }

            $page++;
        } while (count($pageContacts) === $pageLimit);

        return $contacts;
    }

    /** @return array<string, mixed> */
    public function findContactDataByEmail(string $email, ?string $membership = null): array
    {
        $email = strtolower(trim($email));
        $contactsResponse = $this->findContactsByEmail($email, $membership);
        $contacts = $contactsResponse['data']['contacts'] ?? [];

        foreach ($contacts as $contact) {
            $contactEmail = strtolower(trim((string) ($contact['primary_email'] ?? $contact['communication']['primary_email'] ?? '')));
            $contactId = $contact['contact_id'] ?? $contact['basefields']['contact_id'] ?? null;
            if ($contactEmail !== $email || $contactId === null) {
                continue;
            }

            return $this->findContactDataById((string) $contactId);
        }

        return [
            'success' => true,
            'code' => 200,
            'data' => null,
        ];
    }

    /** @return array<string, mixed> */
    public function findContactDataById(string $contactId): array
    {
        try {
            $response = $this->client()->request('GET', sprintf(
                self::CONTACT_DATA_PATH,
                $this->organizationId(),
                $contactId,
            ), [
                'headers' => $this->headers(),
            ]);
        } catch (GuzzleException $exception) {
            ExternalErrorLogger::log('fairgate', 'contact_data', $exception->getMessage());
            throw new FairgateException('FSA contact data request failed.', 0, $exception);
        }

        return $this->decodeResponse('contact_data', $response->getStatusCode(), (string) $response->getBody());
    }

    /** @return array<string, mixed> */
    private function requestContacts(?string $email, int $page, int $pageLimit, ?string $membership = null): array
    {
        $query = ['pageNo' => $page, 'pageLimit' => $pageLimit];
        if ($email !== null) {
            $query['primary_email'] = $email;
        }
        if ($membership !== null && trim($membership) !== '') {
            $query['membership[]'] = trim($membership);
        }

        try {
            $path = $email === null ? self::CONTACTS_PATH : self::FILTERED_CONTACTS_PATH;
            $response = $this->client()->request('GET', sprintf($path, $this->organizationId()), [
                'headers' => $this->headers(),
                'query' => $query,
            ]);
        } catch (GuzzleException $exception) {
            ExternalErrorLogger::log('fairgate', 'contact_lookup', $exception->getMessage());
            throw new FairgateException('FSA contact request failed.', 0, $exception);
        }

        return $this->decodeResponse('contact_lookup', $response->getStatusCode(), (string) $response->getBody());
    }

    private function client(): ClientInterface
    {
        return $this->httpClient ?? new Client([
            'base_uri' => rtrim($this->baseUrl(), '/') . '/',
            'timeout' => 10,
            'http_errors' => false,
        ]);
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        return [
            'Accept' => 'application/json',
            'Accept-Language' => 'de',
            'Authorization' => $this->bearerToken(),
        ];
    }

    private function bearerToken(): string
    {
        if ($this->bearerToken !== null) {
            return $this->bearerToken;
        }

        try {
            $response = $this->client()->request('POST', sprintf(self::TOKEN_PATH, $this->organizationId()), [
                'headers' => [
                    'Accept' => 'application/json',
                    'Accept-Language' => 'de',
                    'Content-Type' => 'application/json',
                ],
                'json' => ['access_key' => $this->accessKey()],
            ]);
        } catch (GuzzleException $exception) {
            ExternalErrorLogger::log('fairgate', 'authentication', $exception->getMessage());
            throw new FairgateException('FSA authentication request failed.', 0, $exception);
        }

        $data = $this->decodeResponse('authentication', $response->getStatusCode(), (string) $response->getBody());
        $token = $data['data']['token'] ?? null;
        if (!is_string($token) || $token === '' || !($this->tokenValidator)($token)) {
            $details = json_encode($data);
            ExternalErrorLogger::log(
                'fairgate',
                'authentication',
                'FSA authentication returned an invalid token.',
                $details === false ? null : $details,
            );
            throw new FairgateException('FSA authentication returned an invalid token.');
        }

        return $this->bearerToken = $token;
    }

    /** @return array<string, mixed> */
    private function decodeResponse(string $operation, int $statusCode, string $body): array
    {
        if ($statusCode < 200 || $statusCode >= 300) {
            $message = sprintf('FSA returned HTTP status %d.', $statusCode);
            ExternalErrorLogger::log('fairgate', $operation, $message, $body, $statusCode);
            throw new FairgateException($message);
        }

        try {
            $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            ExternalErrorLogger::log('fairgate', $operation, $exception->getMessage(), $body, $statusCode);
            throw new FairgateException('FSA returned invalid JSON.', 0, $exception);
        }

        if (!is_array($data) || ($data['success'] ?? true) === false) {
            ExternalErrorLogger::log('fairgate', $operation, 'FSA returned an unsuccessful response.', $body, $statusCode);
            throw new FairgateException('FSA returned an unsuccessful response.');
        }

        return $data;
    }

    private function validateToken(string $token): bool
    {
        try {
            $parsedToken = (new Parser(new JoseEncoder()))->parse($token);
            if (!$parsedToken instanceof UnencryptedToken || $parsedToken->isExpired(new \DateTimeImmutable())) {
                return false;
            }

            return (new Validator())->validate(
                $parsedToken,
                new SignedWith(new Sha512(), InMemory::plainText($this->publicKey())),
            );
        } catch (\Throwable) {
            return false;
        }
    }

    private function baseUrl(): string
    {
        return $this->baseUrl ?? getenv('FSA_BASE_URL') ?: 'https://fsa-test.fairgate.ch';
    }

    private function organizationId(): string
    {
        return $this->organizationId ?? $this->requiredEnvironment('FSA_ORGANIZATION_ID');
    }

    private function accessKey(): string
    {
        return $this->accessKey ?? $this->requiredEnvironment('FSA_ACCESS_KEY');
    }

    private function publicKey(): string
    {
        return str_replace('\\n', "\n", $this->publicKey ?? $this->requiredEnvironment('FSA_PUBLIC_KEY'));
    }

    private function requiredEnvironment(string $name): string
    {
        $value = getenv($name);
        if ($value === false || trim($value) === '') {
            throw new FairgateException(sprintf('Missing required FSA configuration: %s.', $name));
        }

        return $value;
    }
}
