<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Services\FairgateContactProvider;
use App\Fairgate\Services\FairgateOrderDataEvaluator;
use App\Registration\Data\OrderRepository;
use App\Users\Data\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;

final class ClientRegistrationLoginService
{
    public const MEMBERSHIP = 'Klient*innen';

    public function __construct(
        private readonly RegistrationTokenService $tokens,
        private readonly UserRepository $users,
        private readonly FairgateContactProvider $fairgate,
        private readonly ?FrontendConfigRepository $config = null,
        private readonly ?OrderRepository $orders = null,
        private readonly ?FairgateOrderDataEvaluator $evaluator = null,
    ) {
    }

    /** @return array<string, mixed>|null */
    public function login(string $token): ?array
    {
        $email = $this->tokens->consume($token, new DateTimeImmutable('now', new DateTimeZone('UTC')));
        if ($email === null) {
            return null;
        }

        $user = $this->users->findByEmail($email);
        if ($user !== null && ($user['group'] ?? null) !== 'wunschbesteller') {
            return null;
        }

        if ($user === null) {
            $user = $this->users->createUser($email, bin2hex(random_bytes(24)), 'wunschbesteller', true);
        }

        $fairgateResponse = $this->fairgate->findContactDataByEmail($email, self::MEMBERSHIP);
        $data = $fairgateResponse['data'] ?? null;
        $campaignYear = $this->config?->findCampaignYear() ?? (int) (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y');
        $order = $this->orders?->findForYear((string) $user['id'], $campaignYear);
        $orderCreatedAt = is_array($order) && is_string($order['createdAt'] ?? null)
            ? new DateTimeImmutable($order['createdAt'], new DateTimeZone('UTC'))
            : new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $evaluation = is_array($data) && $this->hasUsableData($data)
            ? ($this->evaluator ?? new FairgateOrderDataEvaluator())->evaluate($data, $orderCreatedAt, $campaignYear)
            : ['status' => 'not_found', 'valid' => false, 'childrenCount' => 0, 'adultsCount' => 1];
        $summaryData = $evaluation['valid'] ? $data : null;

        return [
            'user' => $user,
            'firstAccess' => $order === null,
            'fairgateStatus' => $evaluation['status'],
            'fairgateUserExists' => $evaluation['valid'],
            'childrenCount' => $evaluation['valid'] ? $evaluation['childrenCount'] : 0,
            'adultsCount' => $evaluation['valid'] ? $evaluation['adultsCount'] : 1,
            'salutation' => $this->salutation($summaryData),
        ];
    }

    /** @param array<string, mixed> $data */
    private function hasUsableData(array $data): bool
    {
        return array_reduce(
            $data,
            static fn (bool $hasValue, mixed $value): bool => $hasValue || (is_scalar($value) && trim((string) $value) !== ''),
            false,
        );
    }

    /** @param array<string, mixed>|null $data */
    private function salutation(?array $data): string
    {
        if ($data === null) {
            return 'Guten Tag';
        }

        $language = strtolower((string) ($data['correspondence_lang'] ?? 'de'));
        $gender = strtolower((string) ($data['gender'] ?? ''));
        $informal = strtolower((string) ($data['salutation'] ?? '')) === 'informal';

        if ($informal) {
            return match ($language) {
                'fr' => 'Bonjour',
                'it' => 'Buongiorno',
                'en' => 'Hello',
                default => 'Hallo',
            };
        }

        return match ($language) {
            'fr' => $gender === 'female' ? 'Madame' : ($gender === 'male' ? 'Monsieur' : 'Bonjour'),
            'it' => $gender === 'female' ? 'Signora' : ($gender === 'male' ? 'Signor' : 'Buongiorno'),
            'en' => $gender === 'female' ? 'Ms.' : ($gender === 'male' ? 'Mr.' : 'Hello'),
            default => $gender === 'female' ? 'Frau' : ($gender === 'male' ? 'Herr' : 'Guten Tag'),
        };
    }
}
