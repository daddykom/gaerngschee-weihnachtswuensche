<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderItemImageRepository;
use App\Registration\Services\FulfillerAvailabilityService;
use App\Registration\Services\OrderItemImageException;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use DateTimeImmutable;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class PublicFulfillerWishImageAction
{
    public function __construct(
        private readonly ?OrderItemImageRepository $images = null,
        private readonly ?FrontendConfigRepository $configs = null,
        private readonly ?FulfillerAvailabilityService $availability = null,
        private readonly ?DateTimeImmutable $now = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        // Recheck publication on every request, including previously valid image URLs.
        $response = $response->withHeader('Cache-Control', 'no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff');
        try {
            $availability = $this->availability ?? new FulfillerAvailabilityService(Database::getConnection(), $this->configs);
            $status = $availability->status($this->now);
            if ($status !== 'open') {
                return JsonResponse::error($response, $status === 'ended' ? 'FULFILLER_ENDED' : 'FULFILLER_NOT_STARTED', 403);
            }
            $images = $this->images ?? new OrderItemImageRepository(Database::getConnection());
            $image = $images->publicImage($args['itemId'], $args['imageId']);
            $response->getBody()->write($image['data']);
            return $response->withHeader('Content-Type', $image['mimeType'])
                ->withHeader('Content-Length', (string) strlen($image['data']))
                ->withHeader('Content-Disposition', 'inline');
        } catch (OrderItemImageException $exception) {
            return JsonResponse::error($response, $exception->getMessage(), $exception->httpStatus);
        } catch (\Throwable $exception) {
            ExceptionLogger::log('Public wish image retrieval failed', $exception);
            return JsonResponse::error($response, 'IMAGE_LOAD_FAILED', 500);
        }
    }
}
