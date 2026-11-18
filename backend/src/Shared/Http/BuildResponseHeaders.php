<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Psr\Http\Message\ResponseInterface;

final class BuildResponseHeaders
{
    public static function add(ResponseInterface $response, ?string $path = null): ResponseInterface
    {
        $root = dirname(__DIR__, 4);
        $paths = $path !== null ? [$path] : [$root . '/frontend/build-info.json', $root . '/frontend/public/build-info.json'];
        foreach ($paths as $candidate) {
            if (!is_file($candidate) || !is_readable($candidate)) {
                continue;
            }
            $info = json_decode((string) file_get_contents($candidate), true);
            $buildId = is_array($info) ? ($info['buildId'] ?? null) : null;
            if (!is_string($buildId) || preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $buildId) !== 1) {
                continue;
            }
            $exposed = $response->getHeaderLine('Access-Control-Expose-Headers');
            return $response->withHeader('X-App-Build', $buildId)
                ->withHeader('Access-Control-Expose-Headers', $exposed === '' ? 'X-App-Build' : $exposed . ', X-App-Build');
        }
        return $response;
    }
}
