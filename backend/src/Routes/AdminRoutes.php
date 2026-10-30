<?php

declare(strict_types=1);

namespace App\Routes;

use App\Users\Data\UserRepository;
use App\Fairgate\Actions\FairgateTestAction;
use App\Fairgate\Actions\FairgateLookupAction;
use App\Registration\Data\OrderRepository;
use App\Registration\Actions\AdminOrderListAction;
use App\Registration\Actions\AdminOrderUpdateAction;
use App\Configuration\Data\FrontendConfigRepository;
use App\Middleware\AuthMiddleware;
use App\Middleware\GroupMiddleware;
use App\Middleware\SuperuserMiddleware;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Actions\CreateUserAction;
use App\Users\Actions\DeleteUserAction;
use App\Users\Actions\GetUserAction;
use App\Users\Actions\ListUsersAction;
use App\Users\Actions\UpdateUserAction;
use App\Users\Actions\SendPasswordResetLinkAction;
use App\Middleware\RateLimitMiddleware;
use App\Shared\Http\RateLimitService;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

final class AdminRoutes
{
    public static function register(
        App $app,
        ?UserRepository $userRepository = null,
        ?EmailSenderInterface $emailSender = null,
        ?FairgateTestAction $fairgateTestAction = null,
        ?OrderRepository $orderRepository = null,
        ?FrontendConfigRepository $configRepository = null,
        ?RateLimitService $rateLimitService = null,
        ?FairgateLookupAction $fairgateLookupAction = null,
        ?AdminOrderListAction $adminOrderListAction = null,
        ?AdminOrderUpdateAction $adminOrderUpdateAction = null,
    ): void {
        $app->group('/admin', function (RouteCollectorProxy $group) use ($userRepository, $emailSender, $fairgateTestAction, $orderRepository, $configRepository, $rateLimitService, $fairgateLookupAction, $adminOrderListAction, $adminOrderUpdateAction): void {

            $orders = $group->get('/orders', $adminOrderListAction ?? new AdminOrderListAction($orderRepository));
            $orders->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $orderUpdate = $group->patch('/orders/{orderId}', $adminOrderUpdateAction ?? new AdminOrderUpdateAction($orderRepository));
            $orderUpdate->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $list = $group->get('/users', new ListUsersAction($userRepository));
            $list->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $detail = $group->get('/users/{userId}', new GetUserAction($userRepository));
            $detail->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $create = $group->post('/users', new CreateUserAction($userRepository, $emailSender));
            $create->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $update = $group->patch('/users/{userId}', new UpdateUserAction($userRepository, $emailSender));
            $update->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $passwordReset = $group->post('/users/{userId}/password-reset', new SendPasswordResetLinkAction($userRepository, null, $emailSender));
            if ($rateLimitService !== null) {
                $passwordReset->add(new RateLimitMiddleware(10, 3600, static fn ($request): string => RateLimitMiddleware::session($request), $rateLimitService));
            }
            $passwordReset->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $delete = $group->delete('/users/{userId}', new DeleteUserAction($userRepository));
            $delete->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $fairgateTest = $group->get('/fairgate/test', $fairgateTestAction ?? new FairgateTestAction());
            $fairgateTest->add(new GroupMiddleware(['admin'], $userRepository))->add(new AuthMiddleware());

            $fairgateLookup = $group->get('/fairgate-lookup', $fairgateLookupAction ?? new FairgateLookupAction());
            $fairgateLookup->add(new SuperuserMiddleware($userRepository))->add(new AuthMiddleware());
        });
    }
}
