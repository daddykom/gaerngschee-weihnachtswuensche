<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Users\Data\UserRepository;

final class FulfillerRegistrationLoginService
{
    public function __construct(
        private readonly RegistrationTokenService $tokens,
        private readonly UserRepository $users,
    ) {
    }

    /** @return array<string, mixed>|null */
    public function login(string $token): ?array
    {
        $email = $this->tokens->consume($token, null, RegistrationTokenService::FULFILLER);
        if ($email === null) {
            return null;
        }

        $user = $this->users->findByEmail($email);
        if ($user !== null && ($user['group'] ?? null) !== 'wunscherfueller') {
            return null;
        }
        $user ??= $this->users->createUser($email, bin2hex(random_bytes(32)), 'wunscherfueller');

        return ['user' => $user];
    }
}
