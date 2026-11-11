<?php

declare(strict_types=1);

namespace App\Auth\Services;

final class SessionService
{
    private const DEFAULT_IDLE_TIMEOUT = 3600;
    private const USER_ID_KEY = 'user_id';
    private const GROUP_KEY = 'group';
    private const FAIRGATE_USER_EXISTS_KEY = 'fairgate_user_exists';
    private const FAIRGATE_STATUS_KEY = 'fairgate_status';
    private const FAIRGATE_ORDER_DATA_KEY = 'fairgate_order_data';
    private const CSRF_TOKEN_KEY = 'csrf_token';
    private const LAST_ACTIVITY_KEY = 'last_activity';

    public static function configure(): void
    {
        if (session_status() !== PHP_SESSION_NONE) {
            return;
        }

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_set_cookie_params([
            'secure' => getenv('APP_ENV') === 'prod',
            'httponly' => true,
            'samesite' => 'Lax',
            'path' => '/',
        ]);
    }

    public function setUserId(string $userId): void
    {
        $this->ensureSession();
        session_regenerate_id(true);
        $_SESSION[self::USER_ID_KEY] = $userId;
        unset($_SESSION[self::FAIRGATE_ORDER_DATA_KEY]);
        $_SESSION[self::LAST_ACTIVITY_KEY] = time();
    }

    public function setUser(string $userId, string $group, ?bool $fairgateUserExists = null, ?string $fairgateStatus = null): void
    {
        $this->ensureSession();
        session_regenerate_id(true);
        $_SESSION[self::USER_ID_KEY] = $userId;
        $_SESSION[self::GROUP_KEY] = $group;
        unset($_SESSION[self::FAIRGATE_ORDER_DATA_KEY]);
        $_SESSION[self::LAST_ACTIVITY_KEY] = time();
        if ($fairgateUserExists !== null) {
            $_SESSION[self::FAIRGATE_USER_EXISTS_KEY] = $fairgateUserExists;
        } else {
            unset($_SESSION[self::FAIRGATE_USER_EXISTS_KEY]);
        }
        if ($fairgateStatus !== null) {
            $_SESSION[self::FAIRGATE_STATUS_KEY] = $fairgateStatus;
        } else {
            unset($_SESSION[self::FAIRGATE_STATUS_KEY]);
        }
    }

    public function hasUserSession(): bool
    {
        $this->ensureSession();

        return isset($_SESSION[self::USER_ID_KEY]);
    }

    public function getUserId(): ?string
    {
        $this->ensureSession();
        if (!$this->isActive()) {
            return null;
        }

        $userId = $_SESSION[self::USER_ID_KEY] ?? null;

        return is_string($userId) && $userId !== '' ? $userId : null;
    }

    public function getGroup(): ?string
    {
        $this->ensureSession();
        $group = $_SESSION[self::GROUP_KEY] ?? null;

        return is_string($group) && $group !== '' ? $group : null;
    }

    public function getFairgateUserExists(): ?bool
    {
        $this->ensureSession();
        $value = $_SESSION[self::FAIRGATE_USER_EXISTS_KEY] ?? null;

        return is_bool($value) ? $value : null;
    }

    public function getFairgateStatus(): ?string
    {
        $this->ensureSession();
        $value = $_SESSION[self::FAIRGATE_STATUS_KEY] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function setFairgateOrderData(int $year, string $status, ?int $adultsCount, ?int $childrenCount): void
    {
        $this->ensureSession();
        $_SESSION[self::FAIRGATE_ORDER_DATA_KEY] = [
            'year' => $year,
            'status' => $status,
            'adultsCount' => $adultsCount,
            'childrenCount' => $childrenCount,
        ];
    }

    /** @return array{year: int, status: string, adultsCount: ?int, childrenCount: ?int}|null */
    public function getFairgateOrderData(int $year): ?array
    {
        if ($this->getUserId() === null) {
            return null;
        }

        $data = $_SESSION[self::FAIRGATE_ORDER_DATA_KEY] ?? null;

        return is_array($data) && $data['year'] === $year ? $data : null;
    }

    public function getCsrfToken(): string
    {
        $this->ensureSession();
        $token = $_SESSION[self::CSRF_TOKEN_KEY] ?? null;
        if (is_string($token) && $token !== '') {
            return $token;
        }

        $token = bin2hex(random_bytes(32));
        $_SESSION[self::CSRF_TOKEN_KEY] = $token;

        return $token;
    }

    public function isCsrfTokenValid(string $token): bool
    {
        return hash_equals($this->getCsrfToken(), $token);
    }

    public function clear(): void
    {
        $this->ensureSession();
        $_SESSION = [];
        session_destroy();
    }

    public function touchActivity(): void
    {
        $this->ensureSession();
        if ($this->isActive()) {
            $_SESSION[self::LAST_ACTIVITY_KEY] = time();
        }
    }

    /** @return array{expiresAt: string, secondsRemaining: int}|null */
    public function getStatus(): ?array
    {
        $this->ensureSession();
        if (!$this->isActive()) {
            if ($this->hasUserSession()) {
                $this->clear();
            }

            return null;
        }

        $expiresAt = (int) $_SESSION[self::LAST_ACTIVITY_KEY] + $this->idleTimeout();

        return [
            'expiresAt' => gmdate(DATE_ATOM, $expiresAt),
            'secondsRemaining' => max(0, $expiresAt - time()),
        ];
    }

    public function idleTimeout(): int
    {
        $timeout = filter_var(getenv('SESSION_IDLE_TIMEOUT'), FILTER_VALIDATE_INT);

        return is_int($timeout) && $timeout > 0 ? $timeout : self::DEFAULT_IDLE_TIMEOUT;
    }

    private function isActive(): bool
    {
        $userId = $_SESSION[self::USER_ID_KEY] ?? null;
        if (!is_string($userId) || $userId === '') {
            return false;
        }

        $lastActivity = $_SESSION[self::LAST_ACTIVITY_KEY] ?? null;
        return is_int($lastActivity) && $lastActivity + $this->idleTimeout() > time();
    }

    private function ensureSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::configure();
            session_start();
        }
    }
}
