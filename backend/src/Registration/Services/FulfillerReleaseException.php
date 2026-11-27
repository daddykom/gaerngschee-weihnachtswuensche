<?php

declare(strict_types=1);

namespace App\Registration\Services;

final class FulfillerReleaseException extends \RuntimeException
{
    public function __construct(string $code, public readonly int $httpStatus = 409)
    {
        parent::__construct($code);
    }
}
