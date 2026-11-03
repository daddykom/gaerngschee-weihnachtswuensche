<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Services\FakeFairgateClient;
use PHPUnit\Framework\TestCase;

final class FakeFairgateClientTest extends TestCase
{
    public function testFairMarkersAfterPlusReturnTrue(): void
    {
        $client = new FakeFairgateClient();

        self::assertTrue($client->hasContactByEmail('person+fair1@example.com', 'Klient*innen'));
        self::assertTrue($client->hasContactByEmail('person+test-fair2@example.com', 'Klient*innen'));
        self::assertTrue($client->hasContactByEmail('person+FAIR3-test@example.com', 'Klient*innen'));
        self::assertTrue($client->hasContactByEmail('person+fair4-extra@example.com', 'Klient*innen'));
    }

    public function testMissingOrDifferentMarkerReturnsFalse(): void
    {
        $client = new FakeFairgateClient();

        self::assertFalse($client->hasContactByEmail('person@example.com', 'Klient*innen'));
        self::assertFalse($client->hasContactByEmail('person+test@example.com', 'Klient*innen'));
    }

    public function testReturnsDifferentProfilesForFairMarkers(): void
    {
        $client = new FakeFairgateClient();

        $fair1 = $client->findContactDataByEmail('person+fair1@example.com', 'Klient*innen')['data'];
        self::assertSame('Ja', $fair1['wohnt_im_gleichen_haushalt']);
        self::assertSame('Kind 3', $fair1['name_und_vorname_kind3']);
        self::assertSame('2010-01-01', $fair1['geburtsdatum_kind3']);

        $fair2 = $client->findContactDataByEmail('person+fair2@example.com', 'Klient*innen')['data'];
        self::assertSame('Nein', $fair2['wohnt_im_gleichen_haushalt']);
        self::assertArrayNotHasKey('name_und_vorname_kind3', $fair2);

        $fair3 = $client->findContactDataByEmail('person+fair3@example.com', 'Klient*innen')['data'];
        self::assertSame('Ja', $fair3['wohnt_im_gleichen_haushalt']);
        self::assertArrayNotHasKey('name_und_vorname_kind1', $fair3);

        $fair4 = $client->findContactDataByEmail('person+fair4@example.com', 'Klient*innen')['data'];
        self::assertSame('Ja', $fair4['wohnt_im_gleichen_haushalt']);
        self::assertSame('Kind 7', $fair4['name_und_vorname_kind7']);
    }
}
