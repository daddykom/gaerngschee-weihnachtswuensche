<?php

declare(strict_types=1);

namespace App\Routes;

use App\Auth\Actions\AuthenticatedPasswordChangeAction;
use App\Auth\Actions\LoginAction;
use App\Auth\Actions\EmailCheckAction;
use App\Auth\Actions\LogoutAction;
use App\Auth\Actions\PasswordResetAction;
use App\Auth\Actions\PasswordResetRequestAction;
use App\Auth\Actions\RefreshSessionAction;
use App\Auth\Actions\SessionStatusAction;
use App\Registration\Actions\ClientRegistrationLoginAction;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Users\Data\UserRepository;
use App\Middleware\AuthMiddleware;
use App\Auth\Services\SessionService;
use App\Auth\Services\JwtService;
use App\Middleware\RateLimitMiddleware;
use App\Shared\Http\RateLimitService;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

final class AuthRoutes
{
    public static function register(
        App $app,
        ?UserRepository $userRepository = null,
        ?JwtService $jwtService = null,
        ?SessionService $sessionService = null,
        ?ClientRegistrationLoginService $registrationLoginService = null,
        ?RateLimitService $rateLimitService = null,
        ?EmailCheckAction $emailCheckAction = null,
    ): void {
        $app->group('/auth', function (RouteCollectorProxy $group) use (
            $userRepository,
            $jwtService,
            $sessionService,
            $registrationLoginService,
            $rateLimitService,
            $emailCheckAction,
        ): void {
            $authenticatedPasswordChange = $group->post(
                '/password-change-authenticated',
                new AuthenticatedPasswordChangeAction($userRepository),
            );
            $authenticatedPasswordChange->add(new AuthMiddleware());

            $passwordResetRequest = $group->post('/password-reset-request', new PasswordResetRequestAction());
            if ($rateLimitService !== null) {
                $passwordResetRequest->add(new RateLimitMiddleware(3, 900, static fn ($request): string => RateLimitMiddleware::ipAndEmail($request), $rateLimitService));
                $passwordResetRequest->add(new RateLimitMiddleware(20, 3600, static fn ($request): string => RateLimitMiddleware::ip($request), $rateLimitService));
            }

            $passwordReset = $group->post('/password-reset', new PasswordResetAction());
            if ($rateLimitService !== null) {
                $passwordReset->add(new RateLimitMiddleware(10, 900, static fn ($request): string => RateLimitMiddleware::ip($request), $rateLimitService));
            }

            $registrationLogin = $group->post('/registration-login', new ClientRegistrationLoginAction(
                $registrationLoginService,
                $sessionService,
            ));
            if ($rateLimitService !== null) {
                $registrationLogin->add(new RateLimitMiddleware(10, 900, static fn ($request): string => RateLimitMiddleware::ip($request), $rateLimitService));
            }

            $login = $group->post('/login', new LoginAction($userRepository, $sessionService));
            if ($rateLimitService !== null) {
                $login->add(new RateLimitMiddleware(10, 900, static fn ($request): string => RateLimitMiddleware::ipAndEmail($request), $rateLimitService));
                $login->add(new RateLimitMiddleware(50, 900, static fn ($request): string => RateLimitMiddleware::ip($request), $rateLimitService));
            }
            $emailCheck = $group->post('/email-check', $emailCheckAction ?? new EmailCheckAction());
            if ($rateLimitService !== null) {
                $emailCheck->add(new RateLimitMiddleware(5, 900, static fn ($request): string => RateLimitMiddleware::ipAndEmail($request), $rateLimitService));
                $emailCheck->add(new RateLimitMiddleware(30, 900, static fn ($request): string => RateLimitMiddleware::ip($request), $rateLimitService));
            }
            $group->post('/logout', new LogoutAction());
            $group->get('/session-status', new SessionStatusAction($sessionService));
            $group->post('/session-refresh', new RefreshSessionAction($sessionService));
        });
    }
}
