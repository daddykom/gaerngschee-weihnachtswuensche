<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Fairgate\Services\FairgateContactProvider;
use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Registration\Services\RegistrationTokenService;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
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
        self::assertSame('wunschbesteller', $result['user']['group']);
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

    #[DataProvider('storedFairgateData')]
    public function testExistingOrderUsesDatabaseValuesWithoutFairgateLookup(
        ?string $status,
        ?int $adults,
        ?int $children,
        bool $valid,
    ): void {
        $pdo = TestDatabase::create();
        $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $users = new UserRepository($pdo);
        $user = $users->createUser('returning@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $orders->saveForYear($user['id'], 2026, 'draft', 4, 5, [], $status, 'Situation', $adults, $children);
        $tokens = new RegistrationTokenService($pdo);
        $issued = $tokens->issue($user['email']);
        $fairgate = $this->createMock(FairgateContactProvider::class);
        $fairgate->expects(self::never())->method('findContactDataByEmail');
        $fairgate->expects(self::never())->method('hasContactByEmail');
        $service = new ClientRegistrationLoginService($tokens, $users, $fairgate, new FrontendConfigRepository($pdo), $orders);

        $result = $service->login($issued['token']);

        self::assertNotNull($result);
        self::assertFalse($result['firstAccess']);
        self::assertSame(2026, $result['year']);
        self::assertSame($status ?? 'not_found', $result['fairgateStatus']);
        self::assertSame($valid, $result['fairgateUserExists']);
        self::assertSame($valid ? $adults : 1, $result['adultsCount']);
        self::assertSame($valid ? $children : 0, $result['childrenCount']);
        self::assertSame('Guten Tag', $result['salutation']);
    }

    public static function storedFairgateData(): array
    {
        return [
            ['valid', 2, 0, true],
            ['not_found', null, null, false],
            ['valid', 2, null, false],
            [null, null, null, false],
        ];
    }

    public function testNewCampaignLoadsExtendedDataOnceWithoutCreatingAnOrder(): void
    {
        $pdo = TestDatabase::create();
        $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $users = new UserRepository($pdo);
        $user = $users->createUser('new-year@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $orders->saveForYear($user['id'], 2025, 'draft', 2, 3, [], 'valid', 'Situation', 2, 3);
        $tokens = new RegistrationTokenService($pdo);
        $issued = $tokens->issue($user['email']);
        $fairgate = $this->createMock(FairgateContactProvider::class);
        $fairgate->expects(self::once())->method('findContactDataByEmail')
            ->with($user['email'], 'Klient*innen')->willReturn(['data' => ['wohnt_im_gleichen_haushalt' => 'Nein']]);
        $service = new ClientRegistrationLoginService($tokens, $users, $fairgate, new FrontendConfigRepository($pdo), $orders);

        $result = $service->login($issued['token']);

        self::assertTrue($result['firstAccess']);
        self::assertSame(1, $result['adultsCount']);
        self::assertSame(0, $result['childrenCount']);
        self::assertNull($orders->findForYear($user['id'], 2026));
        self::assertSame(1, (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn());
    }
}

final class StubFairgateDataProvider implements FairgateContactProvider
{
    public function hasContactByEmail(string $email, string $membership): bool
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
