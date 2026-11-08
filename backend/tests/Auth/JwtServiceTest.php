<?php

declare(strict_types=1);

namespace Tests\Auth;

use App\Auth\Services\JwtService;
use PHPUnit\Framework\TestCase;

final class JwtServiceTest extends TestCase
{
    protected function setUp(): void
    {
        putenv('JWT_SECRET=01234567890123456789012345678901');
        putenv('JWT_ALGORITHM=HS256');
        putenv('JWT_TTL=3600');
        putenv('JWT_ISSUER=gaerngschee-test');
        putenv('JWT_AUDIENCE=gaerngschee-frontend-test');
    }

    protected function tearDown(): void
    {
        putenv('JWT_SECRET');
        putenv('JWT_ALGORITHM');
        putenv('JWT_TTL');
        putenv('JWT_ISSUER');
        putenv('JWT_AUDIENCE');
    }

    public function testTokenContainsAndVerifiesUserId(): void
    {
        $service = new JwtService();
        $token = $service->createToken('user-123', 2);

        self::assertSame('user-123', $service->getUserIdFromToken($token));
    }

    public function testInvalidTokenIsRejected(): void
    {
        self::assertNull((new JwtService())->verifyToken('invalid-token'));
    }

    public function testTokenWithDifferentAudienceIsRejected(): void
    {
        $service = new JwtService();
        $token = $service->createToken('user-123');

        putenv('JWT_AUDIENCE=another-application');

        self::assertNull($service->verifyToken($token));
    }

    public function testDisallowedAlgorithmIsRejected(): void
    {
        putenv('JWT_ALGORITHM=none');

        $this->expectException(\RuntimeException::class);
        (new JwtService())->createToken('user-123');
    }

    public function testTokenVersionIsRequired(): void
    {
        $service = new JwtService();
        $token = $service->createToken('user-123', 3);

        self::assertSame(3, $service->verifyToken($token)['token_version']);
    }
}
