<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Auth\Services\SessionService;
use App\Registration\Actions\SaveOrderAction;
use App\Registration\Data\OrderRepository;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\TestDatabase;

final class SaveOrderActionTest extends TestCase
{
    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        session_id('save-order-test');
        SessionService::configure();
        session_start();
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            session_destroy();
        }
    }

    #[DataProvider('fairgateStatuses')]
    public function testDraftCanBeReloadedAndSubmittedWithoutSendingDraftEmails(bool $found, string $submittedStatus): void
    {
        $pdo = TestDatabase::create();
        $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $users = new UserRepository($pdo);
        $user = $users->createUser('draft@example.com', 'old-password', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $session = new SessionService();
        $session->setUser($user['id'], 'wunschbesteller');
        $session->setFairgateOrderData(2026, $found ? 'valid' : 'not_found', $found ? 1 : null, $found ? 0 : null);
        $emails = $this->createMock(EmailSenderInterface::class);
        $emails->expects(self::once())->method('renderOrderConfirmation')->willReturn(['subject' => 'Submitted', 'html' => '<p>Submitted</p>', 'text' => 'Submitted']);
        $emails->expects(self::once())->method('sendStoredEmail');
        $action = new SaveOrderAction($orders, new FrontendConfigRepository($pdo), $session, users: $users, emails: $emails);
        $body = ['mode' => 'draft', 'adultsCount' => 1, 'childrenCount' => 0, 'password' => 'long-enough-password', 'passwordConfirmation' => 'long-enough-password', 'text' => 'My situation', 'items' => [['category' => 'gift', 'personType' => 'adult', 'personIndex' => 1, 'title' => 'Coat', 'description' => 'A warm coat']]];
        $save = static function (array $payload) use ($action, $user): Response {
            $request = (new ServerRequestFactory())->createServerRequest('POST', '/client/order')
                ->withAttribute('user', $user);
            $request->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));
            return $action($request, new Response());
        };

        self::assertSame(422, $save([...$body, 'mode' => 'released'])->getStatusCode());
        foreach (['draft', 'submit'] as $mode) {
            self::assertSame(422, $save([...$body, 'mode' => $mode, 'text' => ''])->getStatusCode());
            self::assertSame(422, $save([...$body, 'mode' => $mode, 'items' => []])->getStatusCode());
            self::assertSame(422, $save([...$body, 'mode' => $mode, 'items' => [[...$body['items'][0], 'description' => '']]])->getStatusCode());
        }
        self::assertNull($orders->findForYear($user['id'], 2026));
        self::assertSame(422, $save([...$body, 'passwordConfirmation' => 'wrong-password'])->getStatusCode());
        self::assertSame(422, $save([...$body, 'adultsCount' => 99, 'items' => [$body['items'][0], $body['items'][0]]])->getStatusCode());
        self::assertSame(200, $save([...$body, 'adultsCount' => 99, 'childrenCount' => 99])->getStatusCode());
        $draft = $orders->findForYear($user['id'], 2026);
        self::assertSame('draft', $draft['status']);
        self::assertSame(1, $draft['adultsCount']);
        self::assertSame(0, $draft['childrenCount']);
        self::assertSame('My situation', $draft['currentText']);
        self::assertCount(1, $draft['items']);
        self::assertNull($draft['releasedAt']);
        self::assertSame($found ? 1 : null, $draft['fairgateAdultsCount']);
        self::assertSame($found ? 0 : null, $draft['fairgateChildrenCount']);

        $session->setFairgateOrderData(2026, $found ? 'not_found' : 'valid', $found ? null : 2, $found ? null : 3);

        $body['password'] = $body['passwordConfirmation'] = '';
        $body['items'][0]['id'] = $draft['items'][0]['id'];
        self::assertSame(200, $save($body)->getStatusCode());
        $draft = $orders->findForYear($user['id'], 2026);
        self::assertSame('draft', $draft['items'][0]['status']);
        $body['items'][0]['id'] = $draft['items'][0]['id'];
        self::assertSame(200, $save([...$body, 'mode' => 'submit'])->getStatusCode());
        $submitted = $orders->findForYear($user['id'], 2026);
        self::assertSame($submittedStatus, $submitted['status']);
        self::assertSame($found ? 'valid' : 'not_found', $submitted['fairgateStatus']);
        self::assertSame($found ? 1 : null, $submitted['fairgateAdultsCount']);
        self::assertSame($found ? 0 : null, $submitted['fairgateChildrenCount']);
        self::assertSame('submitted', $submitted['items'][0]['status']);
        self::assertSame(409, $save($body)->getStatusCode());
    }

    public static function fairgateStatuses(): array
    {
        return [[true, 'released']];
    }

    #[DataProvider('missingLoginData')]
    public function testNewOrderWithoutUsableLoginDataCannotBeSaved(?int $snapshotYear, string $mode): void
    {
        $pdo = TestDatabase::create();
        $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $users = new UserRepository($pdo);
        $user = $users->createUser('missing-session@example.com', 'old-password', 'wunschbesteller');
        $session = new SessionService();
        $session->setUser($user['id'], 'wunschbesteller');
        if ($snapshotYear !== null) {
            $session->setFairgateOrderData($snapshotYear, 'not_found', null, null);
        }
        $emails = $this->createMock(EmailSenderInterface::class);
        $emails->expects(self::never())->method('renderOrderConfirmation');
        $emails->expects(self::never())->method('sendStoredEmail');
        $orders = new OrderRepository($pdo);
        $action = new SaveOrderAction($orders, new FrontendConfigRepository($pdo), $session, users: $users, emails: $emails);
        $request = (new ServerRequestFactory())->createServerRequest('POST', '/client/order')->withAttribute('user', $user);
        $request->getBody()->write(json_encode([
            'mode' => $mode,
            'adultsCount' => 1, 'childrenCount' => 0, 'text' => 'Situation',
            'password' => 'long-enough-password', 'passwordConfirmation' => 'long-enough-password',
            'items' => [['category' => 'gift', 'personType' => 'adult', 'personIndex' => 1, 'title' => 'Coat', 'description' => 'A warm coat']],
        ], JSON_THROW_ON_ERROR));

        $response = $action($request, new Response());

        self::assertSame($snapshotYear === 2026 ? 403 : 401, $response->getStatusCode());
        self::assertSame($snapshotYear === 2026 ? 'FAIRGATE_DATA_REQUIRED' : 'SESSION_EXPIRED', json_decode((string) $response->getBody(), true)['error']['code']);
        self::assertNull($orders->findForYear($user['id'], 2026));
        self::assertNotNull($users->verifyPassword($user['email'], 'old-password'));
    }

    public static function missingLoginData(): array
    {
        return [[null, 'draft'], [null, 'submit'], [2025, 'draft'], [2025, 'submit'], [2026, 'draft'], [2026, 'submit']];
    }

    #[DataProvider('storedFairgateData')]
    public function testExistingOrderCanBeSubmittedWithoutSessionSnapshot(
        ?string $fairgateStatus,
        ?int $fairgateAdults,
        ?int $fairgateChildren,
        ?string $expectedStatus,
    ): void {
        $pdo = TestDatabase::create();
        $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $users = new UserRepository($pdo);
        $user = $users->createUser('stored@example.com', 'secret', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $orders->saveForYear($user['id'], 2026, 'draft', 2, 0, [], $fairgateStatus, 'Situation', $fairgateAdults, $fairgateChildren);
        $emails = $this->createMock(EmailSenderInterface::class);
        $emails->expects($expectedStatus === null ? self::never() : self::once())->method('renderOrderConfirmation')->willReturn(['subject' => 'Submitted', 'html' => '<p>Submitted</p>', 'text' => 'Submitted']);
        $emails->expects($expectedStatus === null ? self::never() : self::once())->method('sendStoredEmail');
        $action = new SaveOrderAction($orders, new FrontendConfigRepository($pdo), users: $users, emails: $emails);
        $request = (new ServerRequestFactory())->createServerRequest('POST', '/client/order')->withAttribute('user', $user);
        $request->getBody()->write(json_encode([
            'adultsCount' => 2, 'childrenCount' => 0, 'text' => 'Situation',
            'fairgateAdultsCount' => 2, 'fairgateChildrenCount' => 0, 'fairgateStatus' => 'valid',
            'items' => [['category' => 'gift', 'personType' => 'adult', 'personIndex' => 1, 'title' => 'Coat', 'description' => 'A warm coat']],
        ], JSON_THROW_ON_ERROR));

        $response = $action($request, new Response());
        $data = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        if ($expectedStatus === null) {
            self::assertSame(403, $response->getStatusCode());
            self::assertSame('FAIRGATE_DATA_REQUIRED', $data['error']['code']);
            self::assertSame('draft', $orders->findForYear($user['id'], 2026)['status']);
            return;
        }
        self::assertSame(200, $response->getStatusCode());
        self::assertSame($expectedStatus, $data['status']);
        self::assertSame($fairgateStatus ?? 'not_found', $data['order']['fairgateStatus']);
        self::assertSame($fairgateStatus === 'valid' && $fairgateAdults !== null && $fairgateChildren !== null, $data['fairgateUserExists']);
        self::assertSame($fairgateStatus === 'valid' && $fairgateChildren !== null ? $fairgateAdults : null, $data['order']['fairgateAdultsCount']);
        self::assertSame($fairgateStatus === 'valid' && $fairgateAdults !== null ? $fairgateChildren : null, $data['order']['fairgateChildrenCount']);
    }

    public static function storedFairgateData(): array
    {
        return [
            ['valid', 2, 0, 'released'],
            ['valid', 1, 0, 'released'],
            ['not_found', null, null, null],
            ['valid', 2, null, null],
            [null, null, null, null],
        ];
    }
}
