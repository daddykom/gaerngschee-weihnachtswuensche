<?php

declare(strict_types=1);

namespace App\Registration\Services;

final class GiftReceiptException extends \RuntimeException
{
    public function __construct(string $code, public readonly int $httpStatus = 409, public readonly ?array $result = null)
    {
        parent::__construct($code);
    }
}
