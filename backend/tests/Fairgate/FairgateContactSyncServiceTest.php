<?php

declare(strict_types=1);

namespace Tests\Fairgate;

use App\Fairgate\Data\FairgateContactRepository;
use App\Fairgate\Services\FairgateClient;
use Tests\Support\FairgateTestTokens;
use App\Fairgate\Services\FairgateContactSyncService;
use App\Fairgate\Services\FairgateException;
use DateTimeImmutable;
use DateTimeZone;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use InvalidArgumentException;
use PDO;
use PDOException;
use Phinx\Db\Adapter\SQLiteAdapter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../db/migrations/20261110134342_create_fairgate_contacts_table.php';

final class FairgateContactSyncServiceTest extends TestCase
{
    private PDO $pdo;
    private FairgateContactRepository $contacts;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $adapter = new SQLiteAdapter([]);
        $adapter->setConnection($this->pdo);
        $migration = new \CreateFairgateContactsTable('development', 20261110134342);
        $migration->setAdapter($adapter);
        $migration->setMigratingUp(true);
        $migration->change();
        $this->contacts = new FairgateContactRepository($this->pdo);
    }

    public function testSynchronizesInsertUpdateAndDeletionAndPreservesUnchangedRows(): void
    {
        $old = $this->date('2026-11-10 10:00:00');
        $now = $this->date('2026-11-10 22:00:00');
        $this->contacts->upsert('1', 'old@example.com', $old);
        $this->contacts->upsert('2', 'unchanged@example.com', $old);
        $this->contacts->upsert('3', 'deleted@example.com', $old);
        $before = $this->contacts->findByFairgateId('1');
        $unchanged = $this->contacts->findByFairgateId('2');
        $service = $this->service([
            ['fairgate_contact_id' => '1', 'email' => ' NEW@EXAMPLE.COM '],
            ['fairgate_contact_id' => '2', 'email' => 'unchanged@example.com'],
            ['fairgate_contact_id' => '4', 'email' => 'inserted@example.com'],
        ]);

        self::assertSame(['read' => 3, 'inserted' => 1, 'updated' => 1, 'deleted' => 1], $service->run($now));
        $updated = $this->contacts->findByFairgateId('1');
        self::assertSame($before['id'], $updated['id']);
        self::assertSame($before['created_at'], $updated['created_at']);
        self::assertSame('2026-11-10 22:00:00', $updated['updated_at']);
        self::assertSame('new@example.com', $updated['email']);
        self::assertSame($unchanged, $this->contacts->findByFairgateId('2'));
        self::assertNull($this->contacts->findByFairgateId('3'));
        self::assertSame('2026-11-10 22:00:00', $this->contacts->findByFairgateId('4')['created_at']);
        $snapshot = $this->rows();

        self::assertSame(['read' => 3, 'inserted' => 0, 'updated' => 0, 'deleted' => 0], $service->run($now->modify('+12 hours')));
        self::assertSame($snapshot, $this->rows());
    }

    public function testSupportsEmailSwapsAndReassignmentFromDeletedContacts(): void
    {
        $now = $this->date('2026-11-10 10:00:00');
        $this->contacts->upsert('1', 'first@example.com', $now);
        $this->contacts->upsert('2', 'second@example.com', $now);
        $this->contacts->upsert('3', 'third@example.com', $now);

        self::assertSame(['read' => 3, 'inserted' => 1, 'updated' => 2, 'deleted' => 1], $this->service([
            ['fairgate_contact_id' => '1', 'email' => 'second@example.com'],
            ['fairgate_contact_id' => '2', 'email' => 'first@example.com'],
            ['fairgate_contact_id' => '4', 'email' => 'third@example.com'],
        ])->run($now));
        self::assertSame('1', $this->contacts->findByEmail('second@example.com')['fairgate_contact_id']);
        self::assertSame('2', $this->contacts->findByEmail('first@example.com')['fairgate_contact_id']);
        self::assertSame('4', $this->contacts->findByEmail('third@example.com')['fairgate_contact_id']);
        self::assertNull($this->contacts->findByFairgateId('3'));
    }

    public function testFetchCompletesBeforeDatabaseTransactionStarts(): void
    {
        $service = new FairgateContactSyncService($this->contacts, function (): array {
            self::assertFalse($this->pdo->inTransaction());
            return [['fairgate_contact_id' => '1', 'email' => 'first@example.com']];
        });

        self::assertSame(['read' => 1, 'inserted' => 1, 'updated' => 0, 'deleted' => 0], $service->run());
        self::assertFalse($this->pdo->inTransaction());
    }

    public function testFailedLaterHttpPageLeavesDatabaseUnchanged(): void
    {
        $this->contacts->upsert('1', 'existing@example.com', $this->date('2026-11-10 10:00:00'));
        $before = $this->rows();
        $handler = HandlerStack::create(new MockHandler([
            FairgateTestTokens::response(),
            new Response(200, [], '{"success":true,"data":{"contacts":[{"contact_id":2,"primary_email":"new@example.com"}],"totalPages":2,"totalRecords":2}}'),
            new Response(503, [], '{"success":false}'),
        ]));
        $client = new FairgateClient(new Client(['handler' => $handler, 'base_uri' => 'https://fairgate.example', 'http_errors' => false]), 'https://fairgate.example', 'org', 'access-key', null, static fn (): bool => true, tokenRepository: FairgateTestTokens::repository());
        $service = new FairgateContactSyncService($this->contacts, $client->fetchAllClientContacts(...));

        try {
            $service->run();
            self::fail('The incomplete snapshot must not be applied.');
        } catch (FairgateException) {
            self::assertSame($before, $this->rows());
            self::assertFalse($this->pdo->inTransaction());
        }
    }

    #[DataProvider('invalidSnapshots')]
    public function testInvalidSnapshotLeavesDatabaseUnchanged(array $snapshot): void
    {
        $this->contacts->upsert('1', 'existing@example.com', $this->date('2026-11-10 10:00:00'));
        $before = $this->rows();
        try {
            $this->service($snapshot)->run();
            self::fail('The invalid snapshot must not be applied.');
        } catch (FairgateException|InvalidArgumentException) {
            self::assertSame($before, $this->rows());
            self::assertFalse($this->pdo->inTransaction());
        }
    }

    public static function invalidSnapshots(): array
    {
        return [
            'empty' => [[]],
            'invalid contact' => [[['fairgate_contact_id' => '2', 'email' => 'invalid']]],
            'missing ID' => [[['email' => 'new@example.com']]],
            'non-list' => [['unexpected' => ['fairgate_contact_id' => '2', 'email' => 'new@example.com']]],
            'duplicate ID' => [[['fairgate_contact_id' => '2', 'email' => 'new@example.com'], ['fairgate_contact_id' => '2', 'email' => 'other@example.com']]],
            'duplicate normalized email' => [[['fairgate_contact_id' => '2', 'email' => 'new@example.com'], ['fairgate_contact_id' => '3', 'email' => ' NEW@example.com ']]],
        ];
    }

    public function testDatabaseErrorAfterDeletionRollsBackEntireSnapshot(): void
    {
        $this->contacts->upsert('1', 'existing@example.com', $this->date('2026-11-10 10:00:00'));
        $before = $this->rows();
        // Inject a write failure without changing the production schema.
        $this->pdo->exec("CREATE TEMP TRIGGER reject_contact BEFORE INSERT ON fairgate_contacts
            WHEN NEW.email = 'reject@example.com' BEGIN SELECT RAISE(ABORT, 'Simulated database failure.'); END");
        try {
            $this->service([
                ['fairgate_contact_id' => '2', 'email' => 'first@example.com'],
                ['fairgate_contact_id' => '3', 'email' => 'reject@example.com'],
            ])->run();
            self::fail('The failed write must roll back the snapshot.');
        } catch (PDOException) {
            self::assertSame($before, $this->rows());
            self::assertFalse($this->pdo->inTransaction());
        }
    }

    private function service(array $snapshot): FairgateContactSyncService
    {
        return new FairgateContactSyncService($this->contacts, static fn (): array => $snapshot);
    }

    private function rows(): array
    {
        return $this->pdo->query('SELECT * FROM fairgate_contacts ORDER BY fairgate_contact_id')->fetchAll();
    }

    private function date(string $value): DateTimeImmutable
    {
        return new DateTimeImmutable($value, new DateTimeZone('UTC'));
    }
}
