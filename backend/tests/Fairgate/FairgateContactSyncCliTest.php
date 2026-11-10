<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use PHPUnit\Framework\TestCase;

final class FairgateContactSyncCliTest extends TestCase
{
    public function testFakeModeSkipsSynchronizationWithoutDatabaseOrFairgateAccess(): void
    {
        $result = $this->runCli('');

        self::assertSame(0, $result['exitCode']);
        self::assertSame("Fairgate contact synchronization skipped: fake mode uses email-based profiles.\n", $result['stdout']);
        self::assertSame('', $result['stderr']);
    }

    public function testFakeModeLeavesExistingContactsUnchanged(): void
    {
        $result = $this->runCli(<<<'PHP'
            require '../db/migrations/20261110134342_create_fairgate_contacts_table.php';
            $pdo = new PDO('sqlite::memory:');
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $adapter = new \Phinx\Db\Adapter\SQLiteAdapter([]);
            $adapter->setConnection($pdo);
            $migration = new \CreateFairgateContactsTable('development', 20261110134342);
            $migration->setAdapter($adapter);
            $migration->setMigratingUp(true);
            $migration->change();
            (new ReflectionProperty(\App\Shared\Database\Database::class, 'pdo'))->setValue(null, $pdo);
            $contacts = new \App\Fairgate\Data\FairgateContactRepository($pdo);
            $now = new DateTimeImmutable('2026-11-10 10:00:00');
            $contacts->upsert('1', 'old@example.com', $now);
            $before = $pdo->query('SELECT * FROM fairgate_contacts')->fetchAll();
            register_shutdown_function(static function () use ($pdo, $before): void {
                if ($pdo->query('SELECT * FROM fairgate_contacts')->fetchAll() !== $before) {
                    fwrite(STDERR, 'Existing contacts were changed.');
                    exit(2);
                }
            });
            PHP);

        self::assertSame(0, $result['exitCode']);
        self::assertSame("Fairgate contact synchronization skipped: fake mode uses email-based profiles.\n", $result['stdout']);
        self::assertSame('', $result['stderr']);
    }

    public function testInvalidConfigurationIsReportedOnStderrWithFailureExitCode(): void
    {
        $result = $this->runCli("putenv('FSA_MODE=invalid');");

        self::assertSame(1, $result['exitCode']);
        self::assertSame('', $result['stdout']);
        self::assertStringContainsString('Fairgate contact synchronization failed: Unknown Fairgate mode.', $result['stderr']);
    }

    public function testRealModeDatabaseConnectionFailureIsReportedWithFailureExitCode(): void
    {
        $result = $this->runCli(<<<'PHP'
            putenv('FSA_MODE=real');
            putenv('FSA_BASE_URL=https://example.invalid');
            putenv('FSA_ORGANIZATION_ID=test-org');
            putenv('FSA_ACCESS_KEY=test-key');
            putenv('FSA_PUBLIC_KEY=test-public-key');
            PHP);

        self::assertSame(1, $result['exitCode']);
        self::assertSame('', $result['stdout']);
        self::assertStringContainsString('Fairgate contact synchronization failed:', $result['stderr']);
        self::assertStringContainsString('SQLSTATE', $result['stderr']);
    }

    /** @return array{exitCode: int, stdout: string, stderr: string} */
    private function runCli(string $setup): array
    {
        $bootstrap = <<<'PHP'
            require 'vendor/autoload.php';
            putenv('APP_ENV=test');
            putenv('FSA_MODE=fake');
            putenv('DB_HOST=127.0.0.1');
            putenv('DB_PORT=1');
            PHP;
        $process = proc_open(
            [PHP_BINARY, '-r', $bootstrap . "\n" . $setup . "\nrequire 'bin/sync-fairgate-contacts.php';"],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            dirname(__DIR__, 2),
        );
        self::assertIsResource($process);
        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        return ['exitCode' => proc_close($process), 'stdout' => $stdout, 'stderr' => $stderr];
    }
}
