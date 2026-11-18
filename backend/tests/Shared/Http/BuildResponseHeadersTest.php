<?php

declare(strict_types=1);

namespace Tests\Shared\Http;

use App\Shared\Http\BuildResponseHeaders;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

final class BuildResponseHeadersTest extends TestCase
{
    public function testAddsPublishedBuildWithoutOverwritingExposedEventHeaders(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'build-info-');
        try {
            file_put_contents($path, json_encode(['appVersion' => '1.2.3+4', 'buildId' => 'build-one']));
            $response = BuildResponseHeaders::add((new Response())->withHeader('Access-Control-Expose-Headers', 'X-Event-example'), $path);
            self::assertSame('build-one', $response->getHeaderLine('X-App-Build'));
            self::assertSame('X-Event-example, X-App-Build', $response->getHeaderLine('Access-Control-Expose-Headers'));
        } finally {
            unlink($path);
        }
    }

    public function testMissingOrInvalidMetadataDoesNotBreakTheApi(): void
    {
        self::assertFalse(BuildResponseHeaders::add(new Response(), '/nonexistent/build-info.json')->hasHeader('X-App-Build'));
        $path = tempnam(sys_get_temp_dir(), 'build-info-');
        try {
            foreach (['not json', '{"buildId":123}', '{"buildId":"unsafe\\r\\nheader"}'] as $content) {
                file_put_contents($path, $content);
                self::assertFalse(BuildResponseHeaders::add(new Response(), $path)->hasHeader('X-App-Build'));
            }
        } finally {
            unlink($path);
        }
    }
}
