<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\FulfillerReservationRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class PublicFulfillerWishStatusesAction
{
    public function __construct(private readonly ?FulfillerReservationRepository $reservations = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $repository = $this->reservations ?? new FulfillerReservationRepository(Database::getConnection());
        $repository->releaseExpired(new DateTimeImmutable('now', new DateTimeZone('UTC')));

        return JsonResponse::success($response, ['items' => $repository->findPublicStatuses()]);
    }
}
