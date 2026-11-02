<?php

declare(strict_types=1);

namespace Tests\Configuration;

use App\Configuration\Data\FrontendConfigRepository;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class FrontendConfigRepositoryTest extends TestCase
{
    public function testMapsPatternAndPlaceholderAndValidatesScalarValue(): void
    {
        $pdo = TestDatabase::create();
        $this->insertConfig($pdo, 'config-1', '^(?:[0-9]+)$', 'z. B. 123');
        $repository = new FrontendConfigRepository($pdo);

        $config = $repository->findVisibleForGroup('admin')[0];

        self::assertSame('^(?:[0-9]+)$', $config['pattern']);
        self::assertSame('z. B. 123', $config['placeholder']);
        self::assertNotFalse($repository->update('config-1', 'admin', '123'));
        self::expectException(\InvalidArgumentException::class);
        $repository->update('config-1', 'admin', 'abc');
    }

    public function testValidatesEachArrayValueAndRejectsInvalidPatterns(): void
    {
        $pdo = TestDatabase::create();
        $this->insertConfig($pdo, 'config-2', '[A-Z]+', null);
        $repository = new FrontendConfigRepository($pdo);

        self::assertNotFalse($repository->update('config-2', 'admin', ['ABC', 'XYZ']));
        self::expectException(\InvalidArgumentException::class);
        $repository->update('config-2', 'admin', ['ABC', 'invalid']);
    }

    public function testOrdersVisibleConfigurationsBySortOrderAndVariableName(): void
    {
        $pdo = TestDatabase::create();
        $this->insertConfig($pdo, 'config-z', null, null, 20);
        $this->insertConfig($pdo, 'config-b', null, null, 10);
        $this->insertConfig($pdo, 'config-a', null, null, 10);
        $repository = new FrontendConfigRepository($pdo);

        $configs = $repository->findVisibleForGroup('admin');

        self::assertSame(['config-a', 'config-b', 'config-z'], array_column($configs, 'variableName'));
    }

    public function testRejectsInvalidStoredPattern(): void
    {
        $pdo = TestDatabase::create();
        $this->insertConfig($pdo, 'config-3', '[', null);

        self::expectException(\InvalidArgumentException::class);
        (new FrontendConfigRepository($pdo))->update('config-3', 'admin', 'value');
    }

    public function testReturnsFulfillerStatusForConfiguredDateRange(): void
    {
        $pdo = TestDatabase::create();
        $this->insertDateConfig($pdo, 'fulfiller-start', 'fulfiller_start_date', '2026-08-01');
        $this->insertDateConfig($pdo, 'fulfiller-end', 'fulfiller_end_date', '2026-08-31');
        $repository = new FrontendConfigRepository($pdo);

        self::assertSame(
            'not_started',
            $repository->fulfillerStatus(new DateTimeImmutable('2026-07-31 12:00:00', new DateTimeZone('UTC'))),
        );
        self::assertSame(
            'open',
            $repository->fulfillerStatus(new DateTimeImmutable('2026-08-31 12:00:00', new DateTimeZone('UTC'))),
        );
        self::assertSame(
            'ended',
            $repository->fulfillerStatus(new DateTimeImmutable('2026-09-01 00:00:00', new DateTimeZone('UTC'))),
        );
    }

    private function insertConfig(\PDO $pdo, string $id, ?string $pattern, ?string $placeholder, int $sortOrder = 0): void
    {
        $pdo->prepare(
            'INSERT INTO frontend_config
                (id, variable_name, sort_order, value, description, access_group, update_group, label, pattern, placeholder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )->execute([
            $id,
            $id,
            $sortOrder,
            json_encode('value', JSON_THROW_ON_ERROR),
            'Description',
            '["admin"]',
            '["admin"]',
            'Label',
            $pattern,
            $placeholder,
        ]);
    }

    private function insertDateConfig(\PDO $pdo, string $id, string $variableName, string $value): void
    {
        $pdo->prepare(
            'INSERT INTO frontend_config
                (id, variable_name, sort_order, value, description, access_group, update_group, label)
             VALUES (?, ?, 0, ?, ?, ?, ?, ?)',
        )->execute([
            $id,
            $variableName,
            json_encode($value, JSON_THROW_ON_ERROR),
            'Date configuration',
            '["admin"]',
            '["admin"]',
            $variableName,
        ]);
    }
}
