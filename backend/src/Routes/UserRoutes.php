<?php

declare(strict_types=1);

namespace App\Routes;

use App\Middleware\AuthMiddleware;
use App\Middleware\GroupMiddleware;
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
    ): void {
        $app->group('/user', function (RouteCollectorProxy $group) use ($userRepository, $emailSender): void {
            $profile = $group->get('/profile', new GetUserAction($userRepository));
            $profile->add(new GroupMiddleware(['user', 'admin'], $userRepository))->add(new AuthMiddleware());

            $updateProfile = $group->patch('/profile', new UpdateUserAction($userRepository, $emailSender));
            $updateProfile->add(new GroupMiddleware(['user', 'admin'], $userRepository))->add(new AuthMiddleware());
        });
    }
}
