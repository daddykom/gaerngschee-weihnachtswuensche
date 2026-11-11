<?php

declare(strict_types=1);

namespace Tests\Auth;

use App\Auth\Services\SessionService;
use PHPUnit\Framework\TestCase;

final class SessionServiceTest extends TestCase
{
    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }

        session_id('test-session');
        SessionService::configure();
        session_start();
    }

    protected function tearDown(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            session_destroy();
        }
    }

    public function testUserIdCanBeStoredAndRead(): void
    {
        $service = new SessionService();
        $service->setUserId('user-123');

        self::assertSame('user-123', $service->getUserId());
    }

    public function testSessionCookieUsesSecureDefaults(): void
    {
        $cookieParams = session_get_cookie_params();

        self::assertTrue($cookieParams['httponly']);
        self::assertSame('Lax', $cookieParams['samesite']);
        self::assertSame('/', $cookieParams['path']);
        self::assertFalse($cookieParams['secure']);
    }

    public function testUserIdAndGroupCanBeStoredAndRead(): void
    {
        $service = new SessionService();
        $service->setUser('user-123', 'admin');

        self::assertSame('user-123', $service->getUserId());
        self::assertSame('admin', $service->getGroup());
    }

    public function testClearRemovesUserId(): void
    {
        $service = new SessionService();
        $service->setUserId('user-123');
        $service->clear();

        self::assertNull($service->getUserId());
        self::assertNull($service->getGroup());
    }

    public function testSessionStatusUsesTheConfiguredIdleTimeout(): void
    {
        putenv('SESSION_IDLE_TIMEOUT=60');
        $service = new SessionService();
        $service->setUser('user-123', 'admin');

        $status = $service->getStatus();

        self::assertNotNull($status);
        self::assertGreaterThan(0, $status['secondsRemaining']);
        self::assertLessThanOrEqual(60, $status['secondsRemaining']);
        putenv('SESSION_IDLE_TIMEOUT');
    }

    public function testInactiveSessionIsExpired(): void
    {
        putenv('SESSION_IDLE_TIMEOUT=60');
        $service = new SessionService();
        $service->setUser('user-123', 'admin');
        $_SESSION['last_activity'] = time() - 61;

        self::assertNull($service->getStatus());
        self::assertNull($service->getUserId());
        putenv('SESSION_IDLE_TIMEOUT');
    }

    public function testFairgateOrderDataCanBeReadFromAnotherServiceInstance(): void
    {
        $service = new SessionService();
        $service->setUser('user-123', 'wunschbesteller');
        $service->setFairgateOrderData(2026, 'valid', 2, 0);

        self::assertSame([
            'year' => 2026,
            'status' => 'valid',
            'adultsCount' => 2,
            'childrenCount' => 0,
        ], (new SessionService())->getFairgateOrderData(2026));
        self::assertNull($service->getFairgateOrderData(2027));
    }

    public function testMissingFairgateCountsRemainNull(): void
    {
        $service = new SessionService();
        $service->setUser('user-123', 'wunschbesteller');
        $service->setFairgateOrderData(2026, 'not_found', null, null);

        self::assertSame([
            'year' => 2026,
            'status' => 'not_found',
            'adultsCount' => null,
            'childrenCount' => null,
        ], $service->getFairgateOrderData(2026));
    }

    public function testNewLoginDiscardsFairgateOrderData(): void
    {
        $service = new SessionService();
        $service->setUser('user-123', 'wunschbesteller');
        $service->setFairgateOrderData(2026, 'valid', 2, 1);
        $service->setUser('user-123', 'wunschbesteller');

        self::assertNull($service->getFairgateOrderData(2026));
    }

    public function testUserIdChangeDiscardsFairgateOrderData(): void
    {
        $service = new SessionService();
        $service->setUser('user-123', 'wunschbesteller');
        $service->setFairgateOrderData(2026, 'valid', 2, 1);
        $service->setUserId('user-456');

        self::assertNull($service->getFairgateOrderData(2026));
    }

    public function testLogoutDiscardsFairgateOrderData(): void
    {
        $service = new SessionService();
        $service->setUser('user-123', 'wunschbesteller');
        $service->setFairgateOrderData(2026, 'valid', 2, 1);
        $service->clear();

        self::assertNull($service->getFairgateOrderData(2026));
    }

    public function testExpiredSessionDoesNotExposeFairgateOrderData(): void
    {
        putenv('SESSION_IDLE_TIMEOUT=60');
        try {
            $service = new SessionService();
            $service->setUser('user-123', 'wunschbesteller');
            $service->setFairgateOrderData(2026, 'valid', 2, 1);
            $_SESSION['last_activity'] = time() - 61;

            self::assertNull($service->getFairgateOrderData(2026));
        } finally {
            putenv('SESSION_IDLE_TIMEOUT');
        }
    }
}
