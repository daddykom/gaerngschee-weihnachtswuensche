<?php

declare(strict_types=1);

namespace App\Registration\Services;

use Endroid\QrCode\Color\Color;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;

final class QrCodeGenerator
{
    public function generateDataUri(string $data): string
    {
        return 'data:image/png;base64,' . base64_encode($this->generatePng($data));
    }

    public function generatePng(string $data): string
    {
        $qrCode = new QrCode(
            data: $data,
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::High,
            size: 300,
            margin: 16,
            foregroundColor: new Color(0, 0, 0),
            backgroundColor: new Color(255, 255, 255),
        );

        return (new PngWriter())->write($qrCode)->getString();
    }
}
