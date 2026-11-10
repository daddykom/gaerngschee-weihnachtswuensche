<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Data\FairgateContactRepository;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use PDO;
use PDOException;
use Phinx\Db\Adapter\SQLiteAdapter;
use Phinx\Db\Adapter\ProxyAdapter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261110134342_create_fairgate_contacts_table.php';

final class FairgateContactRepositoryTest extends TestCase
{
    private PDO $pdo;
    private SQLiteAdapter $adapter;
    private FairgateContactRepository $repository;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->adapter = new SQLiteAdapter([]);
        $this->adapter->setConnection($this->pdo);
        $migration = new \CreateFairgateContactsTable('development', 20261110134342);
        $migration->setAdapter($this->adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $this->repository = new FairgateContactRepository($this->pdo);
    }

    public function testStoresNormalizedEmailAndFindsContactByEmailAndFairgateId(): void
    {
        $this->repository->upsert('123', '  Person@Example.com ', $this->date('2026-11-10 10:00:00'));

        $contact = $this->repository->findByEmail(' PERSON@EXAMPLE.COM ');
        self::assertNotNull($contact);
        self::assertSame('person@example.com', $contact['email']);
        self::assertSame('123', $contact['fairgate_contact_id']);
        self::assertSame('2026-11-10 10:00:00', $contact['created_at']);
        self::assertSame($contact['created_at'], $contact['updated_at']);
        self::assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $contact['id']);
        self::assertSame($contact, $this->repository->findByFairgateId('123'));
        self::assertNull($this->repository->findByEmail('missing@example.com'));
        self::assertNull($this->repository->findByFairgateId('missing'));
    }

    public function testUpsertPreservesIdentityAndCreationTimeWhenEmailChanges(): void
    {
        $this->repository->upsert('123', 'old@example.com', $this->date('2026-11-10 10:00:00'));
        $before = $this->repository->findByFairgateId('123');

        $this->repository->upsert('123', 'new@example.com', $this->date('2026-11-10 22:00:00'));
        $after = $this->repository->findByFairgateId('123');

        self::assertSame($before['id'], $after['id']);
        self::assertSame($before['created_at'], $after['created_at']);
        self::assertSame('2026-11-10 22:00:00', $after['updated_at']);
        self::assertSame('new@example.com', $after['email']);
        self::assertNull($this->repository->findByEmail('old@example.com'));
        $this->repository->upsert('123', 'new@example.com', $this->date('2026-11-10 22:00:00'));
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM fairgate_contacts')->fetchColumn());
    }

    public function testRejectsDuplicateEmailWithoutOverwritingExistingContact(): void
    {
        $this->repository->upsert('123', 'person@example.com', $this->date('2026-11-10 10:00:00'));
        try {
            $this->repository->upsert('456', 'PERSON@example.com', $this->date('2026-11-10 22:00:00'));
            self::fail('A duplicate email must not be accepted.');
        } catch (PDOException) {
            self::assertSame('123', $this->repository->findByEmail('person@example.com')['fairgate_contact_id']);
            self::assertNull($this->repository->findByFairgateId('456'));
        }
    }

    public function testRejectsDuplicateEmailOnUpdateWithoutChangingEitherContact(): void
    {
        $now = $this->date('2026-11-10 10:00:00');
        $this->repository->upsert('123', 'first@example.com', $now);
        $this->repository->upsert('456', 'second@example.com', $now);
        try {
            $this->repository->upsert('456', 'first@example.com', $now);
            self::fail('Updating to an existing email must not be accepted.');
        } catch (PDOException) {
            self::assertSame('first@example.com', $this->repository->findByFairgateId('123')['email']);
            self::assertSame('second@example.com', $this->repository->findByFairgateId('456')['email']);
        }
    }

    public function testDeletesOnlyContactsMissingFromSnapshot(): void
    {
        $now = $this->date('2026-11-10 10:00:00');
        $this->repository->upsert('123', 'first@example.com', $now);
        $this->repository->upsert('456', 'second@example.com', $now);

        self::assertSame(1, $this->repository->deleteNotIn(['123']));
        self::assertNotNull($this->repository->findByFairgateId('123'));
        self::assertNull($this->repository->findByFairgateId('456'));
        self::assertSame(0, $this->repository->deleteNotIn(['123']));
        self::assertSame(1, $this->repository->deleteNotIn([]));
        self::assertNull($this->repository->findByFairgateId('123'));
    }

    public function testRepositoryWritesCanBeRolledBackTogether(): void
    {
        $now = $this->date('2026-11-10 10:00:00');
        $this->repository->upsert('123', 'first@example.com', $now);
        $before = $this->repository->findByFairgateId('123');
        $this->pdo->beginTransaction();
        $this->repository->upsert('123', 'changed@example.com', $now);
        $this->repository->upsert('456', 'second@example.com', $now);
        $this->repository->deleteNotIn(['456']);
        $this->pdo->rollBack();

        self::assertSame($before, $this->repository->findByFairgateId('123'));
        self::assertNull($this->repository->findByFairgateId('456'));
    }

    #[DataProvider('invalidContacts')]
    public function testRejectsInvalidContacts(string $contactId, string $email): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->repository->upsert($contactId, $email, $this->date('2026-11-10 10:00:00'));
    }

    public static function invalidContacts(): array
    {
        return [
            ['', 'person@example.com'],
            [' 123 ', 'person@example.com'],
            [str_repeat('1', 256), 'person@example.com'],
            ['123', ''],
            ['123', 'invalid-email'],
            ['123', str_repeat('a', 256) . '@example.com'],
        ];
    }

    public function testMigrationEnforcesUniqueFairgateId(): void
    {
        $this->repository->upsert('123', 'first@example.com', $this->date('2026-11-10 10:00:00'));
        $this->expectException(PDOException::class);
        $this->pdo->exec("INSERT INTO fairgate_contacts (id, email, fairgate_contact_id) VALUES ('other', 'second@example.com', '123')");
    }

    public function testMigrationIsReversible(): void
    {
        $proxy = new ProxyAdapter($this->adapter);
        $migration = new \CreateFairgateContactsTable('development', 20261110134342);
        $migration->setAdapter($proxy);
        $migration->setMigratingUp(false);
        $migration->change();
        $proxy->executeInvertedCommands();

        self::assertFalse($this->adapter->hasTable('fairgate_contacts'));
    }

    private function date(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('UTC'));
    }
}
