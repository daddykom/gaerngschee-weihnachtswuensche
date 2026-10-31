<?php

declare(strict_types=1);

namespace App\Registration\Services;

enum AnmeldungMailVariant: string
{
    case ClientOrder = 'client-order';
    case FulfillerReservation = 'fulfiller-reservation';
}
