<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Services\PickupCodeService;
use App\Registration\Services\QrCodeGenerator;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class PickupQrCodeAction
{
    public function __construct(
        private readonly ?PickupCodeService $codes = null,
        private readonly ?QrCodeGenerator $qrCodes = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args = []): ResponseInterface
    {
        $token = $args['token'] ?? null;
        if (!is_string($token) || preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) {
            return JsonResponse::error($response, 'NOT_FOUND', 404);
        }
        $code = ($this->codes ?? new PickupCodeService())->forToken($token);
        $response->getBody()->write(($this->qrCodes ?? new QrCodeGenerator())->generatePng($code['pickupUrl']));

        return $response->withHeader('Content-Type', 'image/png')
            ->withHeader('Content-Disposition', 'inline; filename="abholcode.png"')
            ->withHeader('Cache-Control', 'private, no-store')
            ->withHeader('Referrer-Policy', 'no-referrer')
            ->withHeader('X-Content-Type-Options', 'nosniff');
    }
}
