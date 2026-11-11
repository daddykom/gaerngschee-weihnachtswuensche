<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Fairgate\Data\FairgateTokenRepository;
use GuzzleHttp\Psr7\Response;
use PDO;
use Phinx\Db\Adapter\SQLiteAdapter;

require_once __DIR__ . '/../../../db/migrations/20261111202851_create_fairgate_api_tokens_table.php';

final class FairgateTestTokens
{
    public static function repository(?PDO $pdo = null): FairgateTokenRepository
    {
        $pdo ??= new PDO('sqlite::memory:');
        $adapter = new SQLiteAdapter(['adapter' => 'sqlite']);
        $adapter->setConnection($pdo);
        $migration = new \CreateFairgateApiTokensTable('development', 20261111202851);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        return new FairgateTokenRepository($pdo);
    }

    public static function token(?int $expiresAt = null): string
    {
        static $defaultExpiration;
        $defaultExpiration ??= time() + 3600;
        $encode = static fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        return $encode('{"alg":"ES512","typ":"JWT"}') . '.'
            . $encode(json_encode(['exp' => $expiresAt ?? $defaultExpiration], JSON_THROW_ON_ERROR)) . '.'
            . $encode(str_repeat('x', 132));
    }

    public static function response(?string $token = null, string $refreshToken = 'test-refresh-token'): Response
    {
        return new Response(200, [], json_encode([
            'success' => true,
            'data' => ['token' => $token ?? self::token(), 'refresh_token' => $refreshToken],
        ], JSON_THROW_ON_ERROR));
    }
}
