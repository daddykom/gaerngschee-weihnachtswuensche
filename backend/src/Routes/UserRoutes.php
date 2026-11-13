<?php

declare(strict_types=1);

namespace App\Routes;

use App\Middleware\AuthMiddleware;
use App\Middleware\GroupMiddleware;
use App\Registration\Actions\GiftReceiptLookupAction;
use App\Users\Actions\GetUserAction;
use App\Users\Actions\UpdateUserAction;
use App\Users\Data\UserRepository;
use App\Shared\Mail\EmailSenderInterface;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

final class UserRoutes
{
    public static function register(
        App $app,
        ?UserRepository $userRepository = null,
        ?EmailSenderInterface $emailSender = null,
        ?GiftReceiptLookupAction $giftReceiptLookup = null,
    ): void {
        $app->group('/user', function (RouteCollectorProxy $group) use ($userRepository, $emailSender, $giftReceiptLookup): void {
            $gift = $group->get('/gift-receipts/{giftNumber}', $giftReceiptLookup ?? new GiftReceiptLookupAction());
            $gift->add(new GroupMiddleware(['user', 'admin'], $userRepository))->add(new AuthMiddleware());

            $profile = $group->get('/profile', new GetUserAction($userRepository));
            $profile->add(new GroupMiddleware(['user', 'admin'], $userRepository))->add(new AuthMiddleware());

            $updateProfile = $group->patch('/profile', new UpdateUserAction($userRepository, $emailSender));
            $updateProfile->add(new GroupMiddleware(['user', 'admin'], $userRepository))->add(new AuthMiddleware());
        });
    }
}
