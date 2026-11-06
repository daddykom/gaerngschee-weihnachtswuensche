<?php

declare(strict_types=1);

namespace Tests\Auth;

use App\Auth\Services\PasswordPolicy;
use PHPUnit\Framework\TestCase;

final class PasswordPolicyTest extends TestCase
{
    public function testAcceptsPasswordsBetweenEightAnd128Characters(): void
    {
        self::assertTrue(PasswordPolicy::accepts(str_repeat('a', 8)));
        self::assertTrue(PasswordPolicy::accepts(str_repeat('a', 128)));
    }

    public function testRejectsPasswordsOutsideTheLengthRange(): void
    {
        self::assertFalse(PasswordPolicy::accepts(str_repeat('a', 7)));
        self::assertFalse(PasswordPolicy::accepts(str_repeat('a', 129)));
    }
}
