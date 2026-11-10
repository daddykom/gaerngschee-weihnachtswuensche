<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

use App\Fairgate\Data\FairgateContactRepository;
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
use PDOException;

final class FairgateClient implements FairgateContactProvider
{
    private const CONTACTS_PATH = '/fsa/v1.1/contact/%s/contacts';
    private const CONTACT_DATA_PATH = '/fsa/v2.0/contact/%s/data/%s';
    private const TOKEN_PATH = '/fsa/v1.1/auth/create/%s/token';
    private const CONTACT_PAGE_LIMIT = 100;

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
        private readonly ?FairgateContactRepository $contacts = null,
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
    private function requestContacts(int $page): array
    {
        $query = ['pageNo' => $page, 'pageLimit' => self::CONTACT_PAGE_LIMIT, 'membership[]' => 'Klient*innen'];

        try {
            $response = $this->client()->request('GET', sprintf(self::CONTACTS_PATH, $this->organizationId()), [
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
