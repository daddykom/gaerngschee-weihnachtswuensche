<?php

declare(strict_types=1);

namespace Tests\Support;

use Slim\Psr7\Stream;
use Slim\Psr7\UploadedFile;

final class OrderItemImageFixture
{
    public static function bytes(string $type = 'png'): string
    {
        $image = imagecreatetruecolor(12, 8);
        imagefill($image, 0, 0, imagecolorallocate($image, 70, 110, 80));
        $stream = fopen('php://temp', 'w+b');
        match ($type) {
            'png' => imagepng($image, $stream),
            'jpeg' => imagejpeg($image, $stream),
            'webp' => imagewebp($image, $stream),
            'gif' => imagegif($image, $stream),
        };
        rewind($stream);
        $bytes = stream_get_contents($stream);
        fclose($stream);
        return $bytes;
    }

    public static function upload(string $bytes, ?int $size = null, int $error = UPLOAD_ERR_OK): UploadedFile
    {
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, $bytes);
        rewind($stream);
        return new UploadedFile(new Stream($stream), 'untrusted.svg', 'image/svg+xml', $size ?? strlen($bytes), $error);
    }
}
