<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Fairgate\Services\FairgateContactProvider;
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
    #[DataProvider('fairgateStatuses')]
    public function testDraftCanBeReloadedAndSubmittedWithoutSendingDraftEmails(bool $found, string $submittedStatus): void
    {
        $pdo = TestDatabase::create();
        $pdo->prepare('INSERT INTO frontend_config (id, variable_name, value, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute(['year', 'campaign_year', '2026', '[]', '[]', 'Year']);
        $users = new UserRepository($pdo);
        $user = $users->createUser('draft@example.com', 'old-password', 'wunschbesteller');
        $orders = new OrderRepository($pdo);
        $fairgate = $this->createMock(FairgateContactProvider::class);
        $fairgate->method('findContactDataByEmail')->willReturn(['data' => $found ? ['wohnt_im_gleichen_haushalt' => 'Nein'] : null]);
        $emails = $this->createMock(EmailSenderInterface::class);
        $emails->expects(self::once())->method('renderOrderConfirmation')->willReturn(['subject' => 'Submitted', 'html' => '<p>Submitted</p>', 'text' => 'Submitted']);
        $emails->expects(self::once())->method('sendStoredEmail');
        $action = new SaveOrderAction($orders, new FrontendConfigRepository($pdo), $fairgate, users: $users, emails: $emails);
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
        self::assertSame(200, $save($body)->getStatusCode());
        $draft = $orders->findForYear($user['id'], 2026);
        self::assertSame('draft', $draft['status']);
        self::assertSame('My situation', $draft['currentText']);
        self::assertCount(1, $draft['items']);
        self::assertNull($draft['releasedAt']);

        $body['password'] = $body['passwordConfirmation'] = '';
        $body['items'][0]['id'] = $draft['items'][0]['id'];
        self::assertSame(200, $save($body)->getStatusCode());
        $draft = $orders->findForYear($user['id'], 2026);
        self::assertSame('draft', $draft['items'][0]['status']);
        $body['items'][0]['id'] = $draft['items'][0]['id'];
        self::assertSame(200, $save([...$body, 'mode' => 'submit'])->getStatusCode());
        $submitted = $orders->findForYear($user['id'], 2026);
        self::assertSame($submittedStatus, $submitted['status']);
        self::assertSame('submitted', $submitted['items'][0]['status']);
        self::assertSame(409, $save($body)->getStatusCode());
    }

    public static function fairgateStatuses(): array
    {
        return [[true, 'released'], [false, 'waiting_for_fairgate']];
    }
}
