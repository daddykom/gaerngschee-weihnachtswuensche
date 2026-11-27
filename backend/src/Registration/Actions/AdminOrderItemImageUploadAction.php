<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\OrderItemImageRepository;
use App\Registration\Services\OrderItemImageException;
use App\Registration\Services\OrderItemImageProcessor;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;

final class AdminOrderItemImageUploadAction
{
    public function __construct(
        private readonly ?OrderItemImageRepository $images = null,
        private readonly ?OrderItemImageProcessor $processor = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $response = $response->withHeader('Cache-Control', 'private, no-store');
        if ((int) $request->getHeaderLine('Content-Length') > 6 * 1024 * 1024) {
            return JsonResponse::error($response, 'IMAGE_TOO_LARGE', 413);
        }
        $body = $request->getParsedBody();
        $revision = is_array($body) ? filter_var($body['revision'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]) : false;
        if ($revision === false || !is_array($body) || !array_key_exists('revision', $body)) {
            return JsonResponse::error($response, 'IMAGE_REVISION_REQUIRED', 422);
        }
        $file = $request->getUploadedFiles()['image'] ?? null;
        if (!$file instanceof UploadedFileInterface) {
            return JsonResponse::error($response, 'IMAGE_REQUIRED', 422);
        }
        // Release the session lock so other admin requests can proceed during image processing.
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        try {
            $images = $this->images ?? new OrderItemImageRepository(Database::getConnection());
            $state = $images->state($args['orderId'], $args['itemId']);
            if ($state['revision'] !== $revision) {
                return JsonResponse::error($response, 'IMAGE_REVISION_CONFLICT', 409);
            }
            $image = ($this->processor ?? new OrderItemImageProcessor())->process($file);
            return JsonResponse::success($response, $images->replace($args['orderId'], $args['itemId'], $revision, $image));
        } catch (OrderItemImageException $exception) {
            return JsonResponse::error($response, $exception->getMessage(), $exception->httpStatus);
        } catch (\Throwable $exception) {
            ExceptionLogger::log('Admin wish image upload failed', $exception);
            return JsonResponse::error($response, 'IMAGE_UPLOAD_FAILED', 500);
        }
    }
}
