<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

use App\Fairgate\Data\FairgateContactRepository;
use App\Fairgate\Data\FairgateTokenRepository;
use App\Shared\Database\Database;
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
use Psr\Http\Message\ResponseInterface;
use PDOException;

final class FairgateClient implements FairgateContactProvider
{
    private const CONTACTS_PATH = '/fsa/v1.1/contact/%s/contacts';
    private const CONTACT_DATA_PATH = '/fsa/v2.0/contact/%s/data/%s';
    private const TOKEN_PATH = '/fsa/v1.1/auth/create/%s/token';
    private const REFRESH_TOKEN_PATH = '/fsa/v1.1/auth/refresh/%s/token';
    private const CONTACT_PAGE_LIMIT = 100;

    private ?FairgateTokenService $tokens = null;

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
        private readonly ?FairgateContactRepository $contacts = null,
        private readonly ?FairgateTokenRepository $tokenRepository = null,
    ) {
        $this->tokenValidator = $tokenValidator ?? $this->validateToken(...);
    }

    /** @var callable(string): bool */
    private $tokenValidator;

    /** @return list<array{email: string, fairgate_contact_id: string}> */
    public function fetchAllClientContacts(): array
    {
        $contacts = [];
        $page = 1;
        $totalPages = null;
        $totalRecords = null;

        do {
            $response = $this->requestContacts($page);
            $data = $response['data'] ?? null;
            if (!is_array($data) || !is_array($data['contacts'] ?? null) || !array_is_list($data['contacts'])) {
                throw new FairgateException('FSA returned an invalid contact list.');
            }

            // Missing pagination must not turn a partial list into a deletion snapshot.
            $pageCount = filter_var($data['totalPages'] ?? null, FILTER_VALIDATE_INT);
            if ($pageCount === false || $pageCount < 0 || ($pageCount === 0 && ($page !== 1 || $data['contacts'] !== []))) {
                throw new FairgateException('FSA returned invalid contact pagination.');
            }
            $pageCount = max(1, $pageCount);
            if (($totalPages !== null && $totalPages !== $pageCount)
                || (isset($data['pageNo']) && filter_var($data['pageNo'], FILTER_VALIDATE_INT) !== $page)
                || ($data['contacts'] === [] && $pageCount > 1)) {
                throw new FairgateException('FSA returned inconsistent contact pagination.');
            }
            $totalPages = $pageCount;

            if (array_key_exists('totalRecords', $data)) {
                $recordCount = filter_var($data['totalRecords'], FILTER_VALIDATE_INT);
                if ($recordCount === false || $recordCount < 0 || ($totalRecords !== null && $totalRecords !== $recordCount)) {
                    throw new FairgateException('FSA returned inconsistent contact counts.');
                }
                $totalRecords = $recordCount;
            }

            foreach ($data['contacts'] as $contact) {
                if (!is_array($contact)) {
                    throw new FairgateException('FSA returned an invalid contact.');
                }
                $email = $contact['primary_email'] ?? $contact['communication']['primary_email'] ?? null;
                $id = $contact['contact_id'] ?? $contact['basefields']['contact_id'] ?? null;
                if (!is_string($email) || (!is_string($id) && !is_int($id))) {
                    throw new FairgateException('FSA returned a contact without an email or ID.');
                }
                $email = strtolower(trim($email));
                $id = (string) $id;
                if (strlen($email) > 255 || filter_var($email, FILTER_VALIDATE_EMAIL) === false
                    || $id === '' || trim($id) !== $id || strlen($id) > 255) {
                    throw new FairgateException('FSA returned an invalid contact email or ID.');
                }
                $contacts[] = ['email' => $email, 'fairgate_contact_id' => $id];
            }
            $page++;
        } while ($page <= $totalPages);

        if ($totalRecords !== null && count($contacts) !== $totalRecords) {
            throw new FairgateException('FSA returned an incomplete contact list.');
        }
        if (count(array_unique(array_column($contacts, 'email'))) !== count($contacts)
            || count(array_unique(array_column($contacts, 'fairgate_contact_id'))) !== count($contacts)) {
            throw new FairgateException('FSA returned duplicate contact emails or IDs.');
        }

        return $contacts;
    }

    public function hasContactByEmail(string $email, string $membership): bool
    {
        return $this->findLocalContact($email, $membership) !== null;
    }

    /** @return array<string, mixed> */
    public function findContactDataByEmail(string $email, ?string $membership = null): array
    {
        $contact = $this->findLocalContact($email, $membership);
        if ($contact !== null) {
            return $this->findContactDataById((string) $contact['fairgate_contact_id']);
        }

        return [
            'success' => true,
            'code' => 200,
            'data' => null,
        ];
    }

    /** @return array<string, mixed>|null */
    private function findLocalContact(string $email, ?string $membership): ?array
    {
        if ($membership !== null && trim($membership) !== 'Klient*innen') {
            throw new \InvalidArgumentException('Only the Fairgate membership Klient*innen is supported.');
        }
        $email = strtolower(trim($email));
        if ($email === '') {
            return null;
        }

        try {
            return ($this->contacts ?? new FairgateContactRepository(Database::getConnection()))->findByEmail($email);
        } catch (PDOException $exception) {
            throw new FairgateException('Local Fairgate contact lookup failed.', 0, $exception);
        }
    }

    /** @return array<string, mixed> */
    public function findContactDataById(string $contactId): array
    {
        return $this->requestAuthenticated('contact_data', sprintf(self::CONTACT_DATA_PATH, $this->organizationId(), $contactId));
    }

    /** @return array<string, mixed> */
    private function requestContacts(int $page): array
    {
        $query = ['pageNo' => $page, 'pageLimit' => self::CONTACT_PAGE_LIMIT, 'membership[]' => 'Klient*innen'];

        return $this->requestAuthenticated('contact_lookup', sprintf(self::CONTACTS_PATH, $this->organizationId()), $query);
    }

    private function client(): ClientInterface
    {
        return $this->httpClient ?? new Client([
            'base_uri' => rtrim($this->baseUrl(), '/') . '/',
            'timeout' => 10,
            'http_errors' => false,
        ]);
    }

    /** @param array<string, mixed> $query @return array<string, mixed> */
    private function requestAuthenticated(string $operation, string $path, array $query = []): array
    {
        $tokens = $this->tokenService();
        $contactList = $operation === 'contact_lookup';
        $token = $tokens->token(contactList: $contactList);
        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                $response = $this->client()->request('GET', $path, [
                    'headers' => ['Accept' => 'application/json', 'Accept-Language' => 'de', 'Authorization' => $token],
                    'query' => $query,
                    'http_errors' => false,
                ]);
            } catch (GuzzleException) {
                ExternalErrorLogger::log('fairgate', $operation, 'FSA data transport failed.');
                throw new FairgateException('FSA data request failed.');
            }
            if ($response->getStatusCode() === 401 && $attempt === 0) {
                $token = $tokens->token($token, $contactList);
                continue;
            }
            if ($response->getStatusCode() === 401) {
                $tokens->rejectAccessToken($token);
            }
            if ($response->getStatusCode() === 429) {
                $listQuota = $contactList && trim($response->getHeaderLine('X-RateLimit-Limit')) === '1';
                $tokens->deferDataRequests($this->retryAfter($response, $listQuota ? 86400 : 300), $listQuota);
            }
            return $this->decodeResponse($operation, $response);
        }
        throw new FairgateException('FSA authorization failed.', 401);
    }

    private function tokenService(): FairgateTokenService
    {
        try {
            return $this->tokens ??= new FairgateTokenService(
                $this->tokenRepository ?? new FairgateTokenRepository(Database::getConnection()),
                hash('sha256', json_encode([rtrim($this->baseUrl(), '/'), $this->organizationId(), $this->accessKey()], JSON_THROW_ON_ERROR)),
                $this->requestToken(...),
                $this->tokenValidator,
            );
        } catch (PDOException $exception) {
            throw new FairgateException('Shared Fairgate token storage is unavailable.', 0, $exception);
        }
    }

    /** @return array<string, mixed> */
    private function requestToken(?string $refreshToken): array
    {
        $operation = $refreshToken === null ? 'authentication' : 'token_refresh';
        try {
            $response = $this->client()->request('POST', sprintf($refreshToken === null ? self::TOKEN_PATH : self::REFRESH_TOKEN_PATH, $this->organizationId()), [
                'headers' => [
                    'Accept' => 'application/json',
                    'Accept-Language' => 'de',
                    'Content-Type' => 'application/json',
                ],
                'json' => $refreshToken === null ? ['access_key' => $this->accessKey()] : ['refresh_token' => $refreshToken],
                'http_errors' => false,
            ]);
        } catch (GuzzleException) {
            ExternalErrorLogger::log('fairgate', $operation, 'FSA authentication transport failed.');
            throw new FairgateException('FSA authentication request failed.');
        }
        return $this->decodeResponse($operation, $response);
    }

    /** @return array<string, mixed> */
    private function decodeResponse(string $operation, ResponseInterface $response): array
    {
        $statusCode = $response->getStatusCode();
        $body = (string) $response->getBody();
        // Authentication bodies can contain access and refresh tokens, including on errors.
        $details = in_array($operation, ['authentication', 'token_refresh'], true) ? null : $body;
        if ($statusCode < 200 || $statusCode >= 300) {
            $message = sprintf('FSA returned HTTP status %d.', $statusCode);
            ExternalErrorLogger::log('fairgate', $operation, $message, $details, $statusCode);
            $fallback = $operation === 'contact_lookup' && trim($response->getHeaderLine('X-RateLimit-Limit')) === '1'
                ? 86400
                : ($details === null ? 900 : 300);
            throw new FairgateException($message, $statusCode, retryAfter: $statusCode === 429 ? $this->retryAfter($response, $fallback) : null);
        }

        try {
            $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            ExternalErrorLogger::log('fairgate', $operation, $exception->getMessage(), $details, $statusCode);
            throw new FairgateException('FSA returned invalid JSON.', 0, $exception);
        }

        if (!is_array($data) || ($data['success'] ?? true) === false) {
            ExternalErrorLogger::log('fairgate', $operation, 'FSA returned an unsuccessful response.', $details, $statusCode);
            throw new FairgateException('FSA returned an unsuccessful response.');
        }

        return $data;
    }

    private function retryAfter(ResponseInterface $response, int $fallback): int
    {
        $value = trim($response->getHeaderLine('X-RateLimit-Retry-After'));
        if ($value === '') {
            $value = trim($response->getHeaderLine('Retry-After'));
        }
        if (ctype_digit($value)) {
            return max(1, (int) $value);
        }
        $deadline = $value !== '' ? strtotime($value) : false;
        return $deadline !== false ? max(1, $deadline - time()) : $fallback;
    }

    private function validateToken(string $token): bool
    {
        try {
            $parsedToken = (new Parser(new JoseEncoder()))->parse(preg_replace('/^Bearer\s+/i', '', $token));
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
