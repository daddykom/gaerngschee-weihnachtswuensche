<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Services\FairgateOrderDataEvaluator;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

final class FairgateOrderDataEvaluatorTest extends TestCase
{
    private FairgateOrderDataEvaluator $evaluator;

    protected function setUp(): void
    {
        $this->evaluator = new FairgateOrderDataEvaluator();
    }

    public function testMissingValidityDateIsValid(): void
    {
        $result = $this->evaluator->evaluate(
            ['wohnt_im_gleichen_haushalt' => 'Nein'],
            $this->date('2026-06-01'),
            2026,
        );

        self::assertTrue($result['valid']);
        self::assertSame('valid', $result['status']);
    }

    public function testValidityDateBeforeOrderDateDoesNotInvalidateMembership(): void
    {
        $result = $this->evaluator->evaluate(
            ['gultig_bis' => '2026-05-31'],
            $this->date('2026-06-01'),
            2026,
        );

        self::assertTrue($result['valid']);
        self::assertSame('valid', $result['status']);
    }

    public function testInvalidValidityDateDoesNotInvalidateMembership(): void
    {
        $result = $this->evaluator->evaluate(
            ['gultig_bis' => '2026-02-30'],
            $this->date('2026-02-01'),
            2026,
        );

        self::assertTrue($result['valid']);
        self::assertSame('valid', $result['status']);
    }

    public function testChildrenRequireNameBirthDateAndAgeUnderEighteenAtStartOfYear(): void
    {
        $result = $this->evaluator->evaluate(
            [
                'name_und_vorname_kind1' => 'Young',
                'geburtsdatum_kind1' => '2008-01-02',
                'name_und_vorname_kind2' => 'Adult',
                'geburtsdatum_kind2' => '2008-01-01',
                'name_und_vorname_kind3' => 'No birth date',
                'name_und_vorname_kind4' => '',
                'geburtsdatum_kind4' => '2010-01-01',
                'name_und_vorname_kind5' => 'Invalid birth date',
                'geburtsdatum_kind5' => 'not-a-date',
            ],
            $this->date('2026-01-01'),
            2026,
        );

        self::assertSame(1, $result['childrenCount']);
    }

    public function testIsoDatesAreAccepted(): void
    {
        $result = $this->evaluator->evaluate(
            [
                'gultig_bis' => '2026-12-31T00:00:00Z',
                'name_und_vorname_kind1' => 'Child',
                'geburtsdatum_kind1' => '2019-03-28T00:00:00Z',
            ],
            $this->date('2026-12-31 12:00:00'),
            2026,
        );

        self::assertTrue($result['valid']);
        self::assertSame(1, $result['childrenCount']);
    }

    private function date(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('UTC'));
    }
}
