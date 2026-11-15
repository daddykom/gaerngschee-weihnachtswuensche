<?php

declare(strict_types=1);

namespace Tests\Registration;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class OrderAcceptanceBackfillCliTest extends TestCase
{
    public function testHelpDoesNotNeedADatabaseOrQueueAnything(): void
    {
        [$code, $stdout, $stderr] = $this->runCli(['--help']);
        self::assertSame(0, $code);
        self::assertStringContainsString('Default: read-only preview.', $stdout);
        self::assertStringContainsString('--send queues', $stdout);
        self::assertSame('', $stderr);
    }

    #[DataProvider('invalidArguments')]
    public function testRejectsMissingYearAndUnknownOrDuplicateArgumentsBeforeOpeningTheDatabase(array $arguments): void
    {
        [$code, $stdout, $stderr] = $this->runCli($arguments);
        self::assertSame(1, $code);
        self::assertSame('', $stdout);
        self::assertStringContainsString('Usage:', $stderr);
    }

    public static function invalidArguments(): array
    {
        return [[[]], [['--send']], [['--year=0']], [['--year=2026x']], [['--year=2026', '--year=2025']], [['--year=2026', '--send', '--send']], [['--year=2026', '--force']], [['2026']]];
    }

    private function runCli(array $arguments): array
    {
        $process = proc_open([PHP_BINARY, __DIR__ . '/../../bin/backfill-order-acceptance.php', ...$arguments], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        self::assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        return [proc_close($process), $stdout, $stderr];
    }
}
