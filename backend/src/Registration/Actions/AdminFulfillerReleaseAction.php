<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\FulfillerReleaseRepository;
use App\Registration\Services\FulfillerReleaseException;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use App\Shared\Mail\EmailSender;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class AdminFulfillerReleaseAction
{
    public function __construct(
        private readonly ?FulfillerReleaseRepository $releases = null,
        private readonly ?EmailSender $emails = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = JsonRequest::body($request);
        $expected = [];
        foreach (['fulfillerEmail', 'fulfillmentStatus', 'reservedAt', 'reservationExpiresAt'] as $field) {
            if (!array_key_exists($field, $body) || ($body[$field] !== null && !is_string($body[$field]))) {
                return JsonResponse::error($response, 'INVALID_RESERVATION_DATA', 422);
            }
            $expected[$field] = $body[$field];
        }
        try {
            $emails = $this->emails ?? new EmailSender();
            $item = ($this->releases ?? new FulfillerReleaseRepository(Database::getConnection()))->release(
                (string) ($args['orderId'] ?? ''),
                (string) ($args['itemId'] ?? ''),
                $expected,
                fn (array $wish): array => $emails->renderFulfillerReleased($wish),
            );
            return JsonResponse::success($response, ['item' => $item]);
        } catch (FulfillerReleaseException $exception) {
            return JsonResponse::error($response, $exception->getMessage(), $exception->httpStatus);
        } catch (Throwable $exception) {
            ExceptionLogger::log('Admin fulfiller release failed', $exception);
            return JsonResponse::error($response, 'FULFILLER_RELEASE_FAILED', 500);
        }
    }
}
