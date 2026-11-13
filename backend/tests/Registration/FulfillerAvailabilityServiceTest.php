<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Registration\Services\FulfillerAvailabilityService;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class FulfillerAvailabilityServiceTest extends TestCase
{
    public function testKeepsFulfillerAccessOpenWithinTheConfiguredDates(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '2026-01-01', '2026-12-31');

        $status = (new FulfillerAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('open', $status);
    }

    public function testRejectsFulfillerAccessBeforeTheStartDate(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '2026-09-01', '2026-12-31');

        $status = (new FulfillerAvailabilityService($pdo))->status($this->date('2026-08-31'));

        self::assertSame('not_started', $status);
    }

    public function testEndsFulfillerAccessAfterTheEndDate(): void
    {
        $pdo = TestDatabase::create();
        $this->addConfiguration($pdo, '2026-01-01', '2026-08-31');

        $status = (new FulfillerAvailabilityService($pdo))->status($this->date('2026-09-01'));

        self::assertSame('ended', $status);
    }

    private function addConfiguration(\PDO $pdo, string $startDate, string $endDate): void
    {
        foreach ([
            ['fulfiller-start', 'fulfiller_start_date', $startDate],
            ['fulfiller-end', 'fulfiller_end_date', $endDate],
        ] as [$id, $variableName, $value]) {
            $pdo->prepare(
                'INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([
                $id,
                $variableName,
                json_encode($value, JSON_THROW_ON_ERROR),
                '["admin", "wunschbesteller"]',
                '["admin"]',
                $variableName,
            ]);
        }
    }

    private function date(string $date): DateTimeImmutable
    {
        return new DateTimeImmutable($date . ' 12:00:00', new DateTimeZone('UTC'));
    }
}
