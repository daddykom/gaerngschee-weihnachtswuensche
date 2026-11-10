<?php

declare(strict_types=1);

namespace Tests\Users;

use App\Auth\Actions\PasswordResetAction;
use App\Auth\Services\PasswordResetTokenService;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Actions\SendPasswordResetLinkAction;
use App\Users\Data\UserRepository;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tests\Support\TestDatabase;

final class SendPasswordResetLinkActionTest extends TestCase
{
    #[DataProvider('userGroups')]
    public function testResetLinkChangesPasswordForEveryGroup(string $group): void
    {
        $pdo = TestDatabase::create();
        $users = new UserRepository($pdo);
        $user = $users->createUser($group . '@example.com', 'old-password', $group, true);
        $tokens = new PasswordResetTokenService($pdo);
        $emails = $this->createMock(EmailSenderInterface::class);
        $resetUrl = null;
        $emails->expects(self::once())->method('sendPasswordReset')
            ->with($user['email'], self::callback(static function (string $url) use (&$resetUrl): bool {
                $resetUrl = $url;
                return true;
            }));
        $request = (new ServerRequestFactory())->createServerRequest('POST', '/admin/users/' . $user['id'] . '/password-reset');
        $response = (new SendPasswordResetLinkAction($users, $tokens, $emails))($request, new Response(), ['userId' => $user['id']]);
        self::assertSame(200, $response->getStatusCode());
        parse_str((string) parse_url($resetUrl, PHP_URL_QUERY), $query);
        $reset = (new ServerRequestFactory())->createServerRequest('POST', '/auth/password-reset');
        $reset->getBody()->write(json_encode(['token' => $query['token'], 'password' => 'new-strong-password'], JSON_THROW_ON_ERROR));
        self::assertSame(200, (new PasswordResetAction($tokens, $users))($reset, new Response())->getStatusCode());
        self::assertNotNull($users->verifyPassword($user['email'], 'new-strong-password'));
        self::assertSame($group, $users->findById($user['id'])['group']);
        self::assertFalse((bool) $users->findById($user['id'])['required_password_reset']);
        self::assertNull($tokens->consume($query['token']));
    }

    public static function userGroups(): array
    {
        return [['admin'], ['user'], ['wunschbesteller'], ['wunscherfueller']];
    }
}
