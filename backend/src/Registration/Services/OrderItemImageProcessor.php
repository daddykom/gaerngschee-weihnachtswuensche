<?php

declare(strict_types=1);

namespace App\Registration\Services;

use Psr\Http\Message\UploadedFileInterface;

final class OrderItemImageProcessor
{
    public const MAX_BYTES = 5 * 1024 * 1024;
    public const MAX_PIXELS = 12_000_000;
    public const MAX_DIMENSION = 8192;

    /** @return array{data: string, mimeType: string, width: int, height: int, byteSize: int} */
    public function process(UploadedFileInterface $file): array
    {
        if (in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new OrderItemImageException('IMAGE_TOO_LARGE', 413);
        }
        if ($file->getError() !== UPLOAD_ERR_OK) {
            throw new OrderItemImageException('IMAGE_UPLOAD_FAILED', 422);
        }
        if (($file->getSize() ?? 0) > self::MAX_BYTES) {
            throw new OrderItemImageException('IMAGE_TOO_LARGE', 413);
        }
        $stream = $file->getStream();
        $stream->rewind();
        $bytes = '';
        while (!$stream->eof() && strlen($bytes) <= self::MAX_BYTES) {
            $chunk = $stream->read(min(65536, self::MAX_BYTES + 1 - strlen($bytes)));
            if ($chunk === '') {
                break;
            }
            $bytes .= $chunk;
        }
        if (strlen($bytes) > self::MAX_BYTES) {
            throw new OrderItemImageException('IMAGE_TOO_LARGE', 413);
        }
        if ($bytes === '') {
            throw new OrderItemImageException('INVALID_IMAGE', 422);
        }
        $size = @getimagesizefromstring($bytes);
        if ($size === false || !in_array($size[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            throw new OrderItemImageException('INVALID_IMAGE', 422);
        }
        [$width, $height] = $size;
        if ($width < 1 || $height < 1 || $width > self::MAX_DIMENSION
            || $height > self::MAX_DIMENSION || $width * $height > self::MAX_PIXELS) {
            throw new OrderItemImageException('IMAGE_DIMENSIONS_EXCEEDED', 422);
        }
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            throw new OrderItemImageException('INVALID_IMAGE', 422);
        }
        // Re-encoding stores pixels only, not client filenames, EXIF or trailing content.
        imagesavealpha($image, true);
        $output = fopen('php://temp', 'w+b');
        if ($output === false) {
            throw new \RuntimeException('Could not allocate the encoded image stream.');
        }
        try {
            $encoded = match ($size[2]) {
                IMAGETYPE_JPEG => imagejpeg($image, $output, 85),
                IMAGETYPE_PNG => imagepng($image, $output, 6),
                IMAGETYPE_WEBP => imagewebp($image, $output, 85),
            };
            if (!$encoded) {
                throw new \RuntimeException('Image encoding failed.');
            }
            rewind($output);
            $data = stream_get_contents($output, self::MAX_BYTES + 1);
            if ($data === false || $data === '') {
                throw new \RuntimeException('Image encoding produced no data.');
            }
            if (strlen($data) > self::MAX_BYTES) {
                throw new OrderItemImageException('IMAGE_TOO_LARGE', 413);
            }
            return [
                'data' => $data,
                'mimeType' => image_type_to_mime_type($size[2]),
                'width' => $width,
                'height' => $height,
                'byteSize' => strlen($data),
            ];
        } finally {
            fclose($output);
        }
    }
}
