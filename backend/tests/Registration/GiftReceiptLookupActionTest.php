<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\GiftReceiptLookupAction;
use App\Registration\Data\GiftReceiptRepository;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\TestDatabase;

final class GiftReceiptLookupActionTest extends TestCase
{
    private PDO $pdo;
    private GiftReceiptLookupAction $action;

    protected function setUp(): void
    {
        $this->pdo = TestDatabase::create();
        $this->pdo->exec("INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label)
            VALUES ('year', 'campaign_year', '\"2035\"', '[]', '[]', 'Year')");
        $this->pdo->exec("INSERT INTO orders (id, user_id, year, order_number, status, admin_notes, pickup_token_hash)
            VALUES ('current', 'client', 2035, 12, 'definitive', 'private-note', 'private-token'),
                   ('previous', 'client', 2034, 12, 'definitive', NULL, NULL),
                   ('previous-only', 'other', 2034, 13, 'definitive', NULL, NULL)");
        $insert = $this->pdo->prepare('INSERT INTO order_items
            (id, order_id, item_number, current_title, original_description, current_description, status, publication_status, fulfillment_status, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ([
            ['current-1', 'current', 1, 'reserved', null],
            ['current-2', 'current', 2, 'received', '2035-11-01 12:00:00'],
            ['current-3', 'current', 3, 'available', null],
            ['previous-1', 'previous', 1, 'reserved', null],
            ['previous-only-1', 'previous-only', 1, 'reserved', null],
        ] as [$id, $order, $number, $status, $receivedAt]) {
            $insert->execute([$id, $order, $number, 'Coat', 'Original description', 'Winter coat', 'approved', 'approved', $status, $receivedAt]);
        }
        $this->action = new GiftReceiptLookupAction(new GiftReceiptRepository($this->pdo), new FrontendConfigRepository($this->pdo));
    }

    public function testFindsTheSelectedWishAndAllOtherWishesOnlyInTheConfiguredCampaignYear(): void
    {
        $response = $this->lookup('12-1');
        self::assertSame(200, $response->getStatusCode());
        $result = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(2035, $result['campaignYear']);
        self::assertSame('current-1', $result['selectedItemId']);
        self::assertSame('current', $result['order']['id']);
        self::assertSame(12, $result['order']['orderNumber']);
        self::assertSame('definitive', $result['order']['status']);
        self::assertSame(['current-1', 'current-2', 'current-3'], array_column($result['order']['items'], 'id'));
        self::assertSame(['12-1', '12-2', '12-3'], array_column($result['order']['items'], 'giftNumber'));
        self::assertSame(['reserved', 'received', 'available'], array_column($result['order']['items'], 'fulfillmentStatus'));
        self::assertSame('2035-11-01 12:00:00', $result['order']['items'][1]['receivedAt']);
        self::assertSame('Coat', $result['order']['items'][0]['currentTitle']);
        self::assertSame('Winter coat', $result['order']['items'][0]['currentDescription']);
        self::assertStringNotContainsString('private-', (string) $response->getBody());
        self::assertArrayNotHasKey('adminNotes', $result['order']);
        self::assertArrayNotHasKey('pickupTokenHash', $result['order']);
    }

    public function testLookingUpReceivedAndUnreservedWishesDoesNotChangeAnyData(): void
    {
        $before = $this->pdo->query('SELECT * FROM order_items ORDER BY id')->fetchAll();
        foreach (['12-2', '12-3'] as $number) {
            self::assertSame(200, $this->lookup($number)->getStatusCode());
        }
        self::assertSame($before, $this->pdo->query('SELECT * FROM order_items ORDER BY id')->fetchAll());
        self::assertSame('definitive', $this->pdo->query("SELECT status FROM orders WHERE id = 'current'")->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM email_queue')->fetchColumn());
    }

    #[DataProvider('invalidNumbers')]
    public function testRejectsInvalidGiftNumbers(mixed $number): void
    {
        $response = $this->lookup($number);
        self::assertSame(400, $response->getStatusCode());
        self::assertSame('INVALID_GIFT_NUMBER', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    public static function invalidNumbers(): array
    {
        return array_map(static fn (mixed $number): array => [$number], [
            null, 12, '', '12', '12-', '-1', '0-1', '1-0', '12-1-2', '12.1-2', '012-1',
            ' 12-1 ', "12-1\n", '2147483648-1', '1-2147483648', '999999999999999999-1', "12-1' OR 1=1",
        ]);
    }

    public function testDoesNotFindWishesFromPreviousYearsOrMissingWishes(): void
    {
        foreach (['13-1', '12-99', '99-1'] as $number) {
            $response = $this->lookup($number);
            self::assertSame(404, $response->getStatusCode());
            self::assertSame('GIFT_NOT_FOUND', json_decode((string) $response->getBody(), true)['error']['code']);
        }
    }

    private function lookup(mixed $number): \Psr\Http\Message\ResponseInterface
    {
        return ($this->action)((new ServerRequestFactory())->createServerRequest('GET', '/'), new Response(), ['giftNumber' => $number]);
    }
}
