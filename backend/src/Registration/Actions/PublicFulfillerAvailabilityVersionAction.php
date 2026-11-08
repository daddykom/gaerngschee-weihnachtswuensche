<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Registration\Data\FulfillerReservationRepository;
use App\Shared\Database\Database;
use App\Shared\Events\EventRepository;
use App\Shared\Http\JsonResponse;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class PublicFulfillerAvailabilityVersionAction
{
    public function __construct(private readonly ?EventRepository $events = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $repository = new FulfillerReservationRepository(Database::getConnection());
        $repository->releaseExpired(new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $events = $this->events ?? new EventRepository(Database::getConnection());

        return JsonResponse::success($response, [
            'version' => $events->all()[FulfillerReservationRepository::AVAILABILITY_EVENT] ?? 0,
        ]);
    }
}
