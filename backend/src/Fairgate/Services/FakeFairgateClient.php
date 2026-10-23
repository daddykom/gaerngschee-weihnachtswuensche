<?php

declare(strict_types=1);

namespace App\Fairgate\Services;

final class FakeFairgateClient implements FairgateContactProvider
{
    public function hasContactByEmail(string $email): bool
    {
        return $this->profileForEmail($email) !== null;
    }

    public function findContactDataByEmail(string $email, ?string $membership = null): array
    {
        $profile = $this->profileForEmail($email);
        if ($profile === null) {
            return ['success' => true, 'data' => null];
        }

        return [
            'success' => true,
            'data' => $profile,
        ];
    }

    /** @return array<string, mixed>|null */
    private function profileForEmail(string $email): ?array
    {
        $email = strtolower(trim($email));
        $localPart = strstr($email, '@', true);
        if ($localPart === false) {
            return null;
        }

        $plusPosition = strpos($localPart, '+');
        if ($plusPosition === false) {
            return null;
        }

        $marker = substr($localPart, $plusPosition + 1);
        $profiles = [
            'fair1' => ['wohnt_im_gleichen_haushalt' => 'Ja', 'children' => 3],
            'fair2' => ['wohnt_im_gleichen_haushalt' => 'Nein', 'children' => 2],
            'fair3' => ['wohnt_im_gleichen_haushalt' => 'Ja', 'children' => 0],
            'fair4' => ['wohnt_im_gleichen_haushalt' => 'Ja', 'children' => 7],
            'expired' => ['wohnt_im_gleichen_haushalt' => 'Nein', 'children' => 1, 'validUntil' => '2025-12-31'],
            'invalid-date' => ['wohnt_im_gleichen_haushalt' => 'Nein', 'children' => 1, 'validUntil' => 'not-a-date'],
            'adult-child' => ['wohnt_im_gleichen_haushalt' => 'Nein', 'children' => 1, 'birthDates' => ['2008-12-31']],
            'partial-child' => ['wohnt_im_gleichen_haushalt' => 'Nein', 'children' => 2, 'birthDates' => ['2010-01-01', null]],
        ];

        foreach ($profiles as $fairMarker => $profile) {
            if (str_contains($marker, $fairMarker)) {
                $data = [
                    'contactId' => 1,
                    'first_name' => 'Test',
                    'last_name' => 'Bezüger',
                    'salutation' => 'Informal',
                    'gender' => 'Female',
                    'correspondence_lang' => 'de',
                    'wohnt_im_gleichen_haushalt' => $profile['wohnt_im_gleichen_haushalt'],
                ];
                if (isset($profile['validUntil'])) {
                    $data['gultig_bis'] = $profile['validUntil'];
                }
                for ($index = 1; $index <= $profile['children']; $index++) {
                    $data['name_und_vorname_kind' . $index] = 'Kind ' . $index;
                    $data['geburtsdatum_kind' . $index] = array_key_exists($index - 1, $profile['birthDates'] ?? [])
                        ? $profile['birthDates'][$index - 1]
                        : '2010-01-01';
                }

                return $data;
            }
        }

        return null;
    }
}
