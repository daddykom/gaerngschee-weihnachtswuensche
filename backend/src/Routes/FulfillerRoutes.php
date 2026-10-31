<?php

declare(strict_types=1);

namespace App\Routes;

use App\Middleware\AuthMiddleware;
use App\Middleware\GroupMiddleware;
use App\Registration\Actions\FulfillerOrderListAction;
use App\Registration\Actions\ReserveWishAction;
use App\Registration\Data\OrderRepository;
use App\Users\Data\UserRepository;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

final class FulfillerRoutes
{
    public static function register(
        App $app,
        ?UserRepository $userRepository = null,
        ?OrderRepository $orderRepository = null,
    ): void {
        $app->group('/fulfiller', function (RouteCollectorProxy $group) use ($userRepository, $orderRepository): void {
            $orders = $group->get('/orders', new FulfillerOrderListAction($orderRepository));
            $orders->add(new GroupMiddleware(['wunscherfueller'], $userRepository))->add(new AuthMiddleware());

            $reserve = $group->post('/order-items/{itemId}/reserve', new ReserveWishAction($orderRepository));
            $reserve->add(new GroupMiddleware(['wunscherfueller'], $userRepository))->add(new AuthMiddleware());
        });
    }
}
