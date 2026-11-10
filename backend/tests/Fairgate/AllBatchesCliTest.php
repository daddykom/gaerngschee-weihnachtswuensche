<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use PHPUnit\Framework\TestCase;

final class AllBatchesCliTest extends TestCase
{
    private string $directory;
    private string $lockPath;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/gaerngschee-batches-test-' . bin2hex(random_bytes(8));
        mkdir($this->directory);
        $this->directory = realpath($this->directory);
        copy(__DIR__ . '/../../bin/process-all-batches.php', $this->directory . '/process-all-batches.php');
        $this->lockPath = sys_get_temp_dir() . '/gaerngschee-batches-' . hash('sha256', $this->directory) . '.lock';
        $this->batch('sync-fairgate-contacts.php', 'contacts');
        $this->batch('process-fairgate-registrations.php', 'registrations');
        $this->batch('process-orders.php', 'orders');
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . '/*.php') as $file) {
            unlink($file);
        }
        rmdir($this->directory);
        if (is_dir($this->lockPath)) {
            rmdir($this->lockPath);
        } elseif (is_file($this->lockPath)) {
            unlink($this->lockPath);
        }
    }

    public function testRunsContactSyncBeforeRegistrationsAndOrders(): void
    {
        $result = $this->runCli();

        self::assertSame(0, $result['exitCode']);
        self::assertSame('', $result['stderr']);
        self::assertSame(['contacts', 'registrations', 'orders'], $this->executedBatches($result['stdout']));
    }

    public function testContactSyncFailureSkipsRegistrationsButStillRunsOrders(): void
    {
        $this->batch('sync-fairgate-contacts.php', 'contacts', 1);
        $result = $this->runCli();

        self::assertSame(1, $result['exitCode']);
        self::assertSame(['contacts', 'orders'], $this->executedBatches($result['stdout']));
        self::assertStringContainsString('Fairgate contacts batch failed with exit code 1.', $result['stderr']);
        self::assertStringContainsString('Skipping fairgate registrations: contact synchronization failed.', $result['stderr']);
    }

    public function testRegistrationFailureDoesNotPreventIndependentOrderBatch(): void
    {
        $this->batch('process-fairgate-registrations.php', 'registrations', 2);
        $result = $this->runCli();

        self::assertSame(1, $result['exitCode']);
        self::assertSame(['contacts', 'registrations', 'orders'], $this->executedBatches($result['stdout']));
        self::assertStringContainsString('Fairgate registrations batch failed with exit code 2.', $result['stderr']);
    }

    public function testOrderFailureIsReported(): void
    {
        $this->batch('process-orders.php', 'orders', 1);
        $result = $this->runCli();

        self::assertSame(1, $result['exitCode']);
        self::assertSame(['contacts', 'registrations', 'orders'], $this->executedBatches($result['stdout']));
        self::assertStringContainsString('Orders batch failed with exit code 1.', $result['stderr']);
    }

    public function testConcurrentRunIsSkippedAndLockIsReusableAfterRelease(): void
    {
        $lock = fopen($this->lockPath, 'c');
        self::assertTrue(flock($lock, LOCK_EX | LOCK_NB));
        try {
            $result = $this->runCli();
            self::assertSame(0, $result['exitCode']);
            self::assertSame("Batch runner skipped: another run is already active.\n", $result['stdout']);
            self::assertSame('', $result['stderr']);
        } finally {
            fclose($lock);
        }

        $result = $this->runCli();
        self::assertSame(0, $result['exitCode']);
        self::assertSame(['contacts', 'registrations', 'orders'], $this->executedBatches($result['stdout']));
    }

    public function testFailedRunReleasesLockForNextRun(): void
    {
        $this->batch('sync-fairgate-contacts.php', 'contacts', 1);
        self::assertSame(1, $this->runCli()['exitCode']);
        $this->batch('sync-fairgate-contacts.php', 'contacts');

        $result = $this->runCli();
        self::assertSame(0, $result['exitCode']);
        self::assertSame(['contacts', 'registrations', 'orders'], $this->executedBatches($result['stdout']));
    }

    public function testUnusableLockPathFailsWithoutStartingAnyBatch(): void
    {
        mkdir($this->lockPath);
        $result = $this->runCli();

        self::assertSame(1, $result['exitCode']);
        self::assertSame('', $result['stdout']);
        self::assertSame("Could not open the batch runner lock.\n", $result['stderr']);
    }

    public function testRealSyncScriptSkipsInFakeModeAndRunnerContinues(): void
    {
        $script = var_export(__DIR__ . '/../../bin/sync-fairgate-contacts.php', true);
        file_put_contents($this->directory . '/sync-fairgate-contacts.php', '<?php require ' . $script . ';');
        $result = $this->runCli();

        self::assertSame(0, $result['exitCode']);
        self::assertSame('', $result['stderr']);
        self::assertStringContainsString('Fairgate contact synchronization skipped: fake mode uses email-based profiles.', $result['stdout']);
        self::assertSame(['registrations', 'orders'], $this->executedBatches($result['stdout']));
    }

    private function batch(string $filename, string $name, int $exitCode = 0): void
    {
        file_put_contents($this->directory . '/' . $filename, '<?php echo "Executed ' . $name . '\n"; exit(' . $exitCode . ');');
    }

    private function executedBatches(string $stdout): array
    {
        preg_match_all('/^Executed (.+)$/m', $stdout, $matches);
        return $matches[1];
    }

    /** @return array{exitCode: int, stdout: string, stderr: string} */
    private function runCli(): array
    {
        $environment = [...getenv(), 'APP_ENV' => 'test', 'FSA_MODE' => 'fake', 'DB_HOST' => '127.0.0.1', 'DB_PORT' => '1'];
        $process = proc_open(
            [PHP_BINARY, $this->directory . '/process-all-batches.php'],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            $this->directory,
            $environment,
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
