<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderItemImageRepository;
use App\Registration\Services\OrderItemImageException;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminOrderItemImageMetadataAction
{
    public function __construct(private readonly ?OrderItemImageRepository $images = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $response = $response->withHeader('Cache-Control', 'private, no-store');
        try {
            $images = $this->images ?? new OrderItemImageRepository(Database::getConnection());
            return JsonResponse::success($response, $images->state($args['orderId'], $args['itemId']));
        } catch (OrderItemImageException $exception) {
            return JsonResponse::error($response, $exception->getMessage(), $exception->httpStatus);
        } catch (\Throwable $exception) {
            ExceptionLogger::log('Admin wish image metadata retrieval failed', $exception);
            return JsonResponse::error($response, 'IMAGE_LOAD_FAILED', 500);
        }
    }
}
