<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

use DateTimeImmutable;
use DateTimeZone;

final class FairgateOrderDataEvaluator
{
    /** @param array<string, mixed> $data */
    public function evaluate(array $data, DateTimeImmutable $orderCreatedAt, int $processingYear): array
    {
        $status = 'valid';

        return [
            'status' => $status,
            'valid' => $status === 'valid',
            'childrenCount' => $this->childrenCount($data, $processingYear),
            'adultsCount' => ($data['wohnt_im_gleichen_haushalt'] ?? null) === 'Ja' ? 2 : 1,
        ];
    }

    /** @param array<string, mixed> $data */
    private function childrenCount(array $data, int $processingYear): int
    {
        $referenceDate = new DateTimeImmutable($processingYear . '-01-01 00:00:00', new DateTimeZone('UTC'));
        $count = 0;

        for ($index = 1; $index <= 10; $index++) {
            $name = trim((string) ($data['name_und_vorname_kind' . $index] ?? ''));
            $birthDateValue = $data['geburtsdatum_kind' . $index] ?? null;
            if ($name === '' || $birthDateValue === null || trim((string) $birthDateValue) === '') {
                continue;
            }

            $birthDate = $this->parseDate((string) $birthDateValue);
            if ($birthDate !== null && $birthDate->format('Y-m-d') > $referenceDate->modify('-18 years')->format('Y-m-d')) {
                $count++;
            }
        }

        return $count;
    }

    private function parseDate(string $value): ?DateTimeImmutable
    {
        $timezone = new DateTimeZone('UTC');
        if (preg_match('/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/', $value, $matches) !== 1) {
            return null;
        }

        $datePart = $matches[1];
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $datePart, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            return null;
        }

        if (str_contains($value, 'T')) {
            $normalized = str_ends_with($value, 'Z') ? substr($value, 0, -1) . '+00:00' : $value;
            $format = str_contains($normalized, '.') ? 'Y-m-d\TH:i:s.uP' : 'Y-m-d\TH:i:sP';
            $dateTime = DateTimeImmutable::createFromFormat($format, $normalized, $timezone);
            $errors = DateTimeImmutable::getLastErrors();
            if ($dateTime === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
                return null;
            }
        }

        return $date;
    }
}
