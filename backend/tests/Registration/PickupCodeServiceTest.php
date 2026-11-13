<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Services\PickupCodeService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PickupCodeServiceTest extends TestCase
{
    public function testCreatesRandomTokensWithOnlyTheirHashIntendedForStorage(): void
    {
        $codes = new PickupCodeService('https://wishes.example/', 'https://wishes.example/api/');
        $first = $codes->create();
        $second = $codes->create();
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $first['token']);
        self::assertNotSame($first['token'], $second['token']);
        self::assertSame(hash('sha256', $first['token']), $first['tokenHash']);
        self::assertNotSame($first['token'], $first['tokenHash']);
        self::assertSame('https://wishes.example/abholung/' . $first['token'], $first['pickupUrl']);
        self::assertSame('https://wishes.example/api/public/pickup-qr-code/' . $first['token'], $first['imageUrl']);
        self::assertSame($first, $codes->forToken($first['token']));
    }

    #[DataProvider('invalidTokens')]
    public function testRejectsInvalidTokens(string $token): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new PickupCodeService())->forToken($token);
    }

    public static function invalidTokens(): array
    {
        return array_map(static fn (string $token): array => [$token], ['', 'test', str_repeat('a', 63), str_repeat('a', 65), str_repeat('G', 64), str_repeat('a', 64) . "\n", '../../etc/passwd']);
    }
}
