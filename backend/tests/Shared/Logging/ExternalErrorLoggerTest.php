<?php

declare(strict_types=1);

namespace Tests\Shared\Logging;

use App\Shared\Database\Database;
use App\Shared\Logging\ExternalErrorLogger;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class ExternalErrorLoggerTest extends TestCase
{
    public function testBootstrapProvidesAnIsolatedDatabaseConnection(): void
    {
        self::assertSame('sqlite', Database::getConnection()->getAttribute(\PDO::ATTR_DRIVER_NAME));
    }

    public function testPersistsErrorsUsingTheProvidedTestConnection(): void
    {
        $previous = Database::getConnection();
        $pdo = TestDatabase::create();
        Database::setConnection($pdo);

        try {
            ExternalErrorLogger::log('fairgate', 'contact_lookup', 'Transport failed.', '{"retry":true}', 503, 'order-1');

            self::assertSame([
                'source' => 'fairgate',
                'operation' => 'contact_lookup',
                'message' => 'Transport failed.',
                'details' => '{"retry":true}',
                'http_status' => 503,
                'order_id' => 'order-1',
            ], $pdo->query('SELECT source, operation, message, details, http_status, order_id FROM external_error_logs')->fetch());
        } finally {
            Database::setConnection($previous);
        }
    }
}
