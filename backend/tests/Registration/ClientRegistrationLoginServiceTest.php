<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Fairgate\Services\FairgateContactProvider;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Registration\Services\RegistrationTokenService;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestDatabase;

final class ClientRegistrationLoginServiceTest extends TestCase
{
    public function testCreatesClientAndReturnsFairgateSummary(): void
    {
        $pdo = TestDatabase::create();
        $email = 'person@example.com';
        $tokens = new RegistrationTokenService($pdo);
        $issued = $tokens->issue($email);
        $service = new ClientRegistrationLoginService(
            $tokens,
            new UserRepository($pdo),
            new StubFairgateDataProvider(),
        );

        $result = $service->login($issued['token']);

        self::assertNotNull($result);
        self::assertSame('client', $result['user']['group']);
        self::assertTrue($result['fairgateUserExists']);
        self::assertSame(2, $result['childrenCount']);
        self::assertSame(2, $result['adultsCount']);
        self::assertSame('Hallo', $result['salutation']);
    }

    public function testDoesNotReplaceExistingNonClientUser(): void
    {
        $pdo = TestDatabase::create();
        $users = new UserRepository($pdo);
        $users->createUser('admin@example.com', 'secret', 'admin');
        $tokens = new RegistrationTokenService($pdo);
        $issued = $tokens->issue('admin@example.com');
        $service = new ClientRegistrationLoginService($tokens, $users, new StubFairgateDataProvider());

        self::assertNull($service->login($issued['token']));
        self::assertSame('admin', $users->findByEmail('admin@example.com')['group']);
    }

    public function testInvalidTokenDoesNotCreateAClient(): void
    {
        $pdo = TestDatabase::create();
        $users = new UserRepository($pdo);
        $service = new ClientRegistrationLoginService(
            new RegistrationTokenService($pdo),
            $users,
            new StubFairgateDataProvider(),
        );

        self::assertNull($service->login('invalid-token'));
        self::assertSame(0, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }

    public function testRegistrationTokenCannotBeReusedForClientLogin(): void
    {
        $pdo = TestDatabase::create();
        $users = new UserRepository($pdo);
        $tokens = new RegistrationTokenService($pdo);
        $issued = $tokens->issue('person@example.com');
        $service = new ClientRegistrationLoginService($tokens, $users, new StubFairgateDataProvider());

        self::assertNotNull($service->login($issued['token']));
        self::assertNull($service->login($issued['token']));
        self::assertSame(1, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
    }
}

final class StubFairgateDataProvider implements FairgateContactProvider
{
    public function hasContactByEmail(string $email): bool
    {
        return true;
    }

    public function findContactDataByEmail(string $email, ?string $membership = null): array
    {
        return [
            'success' => true,
            'data' => [
                'gender' => 'Female',
                'salutation' => 'Informal',
                'correspondence_lang' => 'de',
                'wohnt_im_gleichen_haushalt' => 'Ja',
                'name_und_vorname_kind1' => 'Child One',
                'name_und_vorname_kind2' => 'Child Two',
                'geburtsdatum_kind1' => '2010-01-01',
                'geburtsdatum_kind2' => '2011-01-01',
            ],
        ];
    }
}
