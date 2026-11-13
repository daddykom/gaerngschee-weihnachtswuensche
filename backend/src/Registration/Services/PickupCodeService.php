<?php

declare(strict_types=1);

namespace App\Registration\Services;

final class PickupCodeService
{
    private readonly string $frontendBaseUrl;
    private readonly string $apiBaseUrl;

    public function __construct(?string $frontendBaseUrl = null, ?string $apiBaseUrl = null)
    {
        $this->frontendBaseUrl = rtrim($frontendBaseUrl ?? (getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200'), '/');
        $this->apiBaseUrl = rtrim($apiBaseUrl ?? (getenv('PUBLIC_API_BASE_URL') ?: $this->frontendBaseUrl . '/api'), '/');
    }

    /** @return array{token: string, tokenHash: string, pickupUrl: string, imageUrl: string} */
    public function create(): array
    {
        return $this->forToken(bin2hex(random_bytes(32)));
    }

    /** @return array{token: string, tokenHash: string, pickupUrl: string, imageUrl: string} */
    public function forToken(string $token): array
    {
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            throw new \InvalidArgumentException('Invalid pickup token.');
        }

        return [
            'token' => $token,
            'tokenHash' => hash('sha256', $token),
            'pickupUrl' => $this->frontendBaseUrl . '/abholung/' . $token,
            'imageUrl' => $this->apiBaseUrl . '/public/pickup-qr-code/' . $token,
        ];
    }
}
