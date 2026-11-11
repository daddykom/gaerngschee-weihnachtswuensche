<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Data\FairgateTokenRepository;
use App\Fairgate\Services\FairgateTokenService;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Tests\Support\FairgateTestTokens;

final class FairgateTokenRepositoryTest extends TestCase
{
    public function testScopesStayIsolatedAndFailedTransactionsRollBack(): void
    {
        $tokens = FairgateTestTokens::repository();
        $tokens->synchronized('one', function () use ($tokens): void {
            $tokens->saveTokens('one', 'token', 'refresh', 1234);
        });
        try {
            $tokens->synchronized('one', function () use ($tokens): void {
                $tokens->saveTokens('one', 'changed', 'changed', 9999);
                throw new RuntimeException('Simulated failure.');
            });
        } catch (RuntimeException) {
            self::assertSame('token', $tokens->synchronized('one', static fn (array $row): string => $row['access_token']));
        }
        self::assertNull($tokens->synchronized('two', static fn (array $row): ?string => $row['access_token']));
    }

    public function testExistingApplicationTransactionIsNotCommittedOrRolledBack(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $tokens = FairgateTestTokens::repository($pdo);
        $pdo->beginTransaction();
        try {
            $tokens->synchronized('scope', static fn (): string => 'unexpected');
            self::fail('Nested token access must not alter application transactions.');
        } catch (RuntimeException) {
            self::assertTrue($pdo->inTransaction());
        } finally {
            $pdo->rollBack();
        }
    }

    public function testConcurrentProcessesAuthenticateOnlyOnce(): void
    {
        if (!function_exists('pcntl_fork')) {
            self::markTestSkipped('The concurrency test requires pcntl.');
        }
        $database = tempnam(sys_get_temp_dir(), 'fairgate-token-test-');
        $pdo = new PDO('sqlite:' . $database);
        FairgateTestTokens::repository($pdo);
        $pdo = null;
        $children = [];
        try {
            for ($index = 0; $index < 2; $index++) {
                $pid = pcntl_fork();
                self::assertNotSame(-1, $pid);
                if ($pid === 0) {
                    try {
                        $connection = new PDO('sqlite:' . $database);
                        $connection->exec('PRAGMA busy_timeout = 5000');
                        $service = new FairgateTokenService(new FairgateTokenRepository($connection), 'shared-scope', static function () use ($database): array {
                            file_put_contents($database . '.auth', 'authentication\n', FILE_APPEND | LOCK_EX);
                            usleep(200000);
                            return ['data' => ['token' => FairgateTestTokens::token(), 'refresh_token' => 'refresh']];
                        }, static fn (): bool => true);
                        file_put_contents($database . '.' . $index, $service->token());
                        exit(0);
                    } catch (\Throwable) {
                        exit(1);
                    }
                }
                $children[] = $pid;
            }
            foreach ($children as $pid) {
                pcntl_waitpid($pid, $status);
                self::assertSame(0, pcntl_wexitstatus($status));
            }
            self::assertSame('authentication\n', file_get_contents($database . '.auth'));
            self::assertSame(file_get_contents($database . '.0'), file_get_contents($database . '.1'));
        } finally {
            foreach ([$database, $database . '.auth', $database . '.0', $database . '.1'] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
        }
    }
}
