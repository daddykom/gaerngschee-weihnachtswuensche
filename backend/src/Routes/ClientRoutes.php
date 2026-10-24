<?php

declare(strict_types=1);

namespace App\Routes;

use App\Registration\Actions\OrderOverviewAction;
use App\Registration\Actions\SaveOrderAction;
use App\Users\Data\UserRepository;
use App\Middleware\AuthMiddleware;
use App\Middleware\GroupMiddleware;
use Slim\App;

final class ClientRoutes
{
    public static function register(App $app, ?UserRepository $userRepository = null): void
    {
        $order = $app->get('/client/order', new OrderOverviewAction());
        $order->add(new GroupMiddleware(['wunschbesteller'], $userRepository))->add(new AuthMiddleware());
        $save = $app->post('/client/order', new SaveOrderAction());
        $save->add(new GroupMiddleware(['wunschbesteller'], $userRepository))->add(new AuthMiddleware());
    }
}
