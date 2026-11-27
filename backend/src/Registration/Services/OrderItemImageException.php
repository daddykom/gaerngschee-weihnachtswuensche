<?php

declare(strict_types=1);

namespace App\Registration\Services;

final class OrderItemImageException extends \RuntimeException
{
    public function __construct(string $code, public readonly int $httpStatus)
    {
        parent::__construct($code);
    }
}
