<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Auth\Services\SessionService;
use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\ClientRegistrationLoginService;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class ClientRegistrationLoginAction
{
    public function __construct(
        private readonly ?ClientRegistrationLoginService $loginService = null,
        private readonly ?SessionService $session = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = JsonRequest::string(JsonRequest::body($request), 'token', 2048);
        if ($token === null) {
            return JsonResponse::error($response, 'INVALID_REGISTRATION_TOKEN', 401);
        }

        try {
            $result = ($this->loginService ?? self::createService())->login($token);
        } catch (Throwable $exception) {
            ExceptionLogger::log('Client registration login failed', $exception);
            return JsonResponse::error($response, 'REGISTRATION_LOGIN_FAILED', 503);
        }

        if ($result === null) {
            return JsonResponse::error($response, 'INVALID_REGISTRATION_TOKEN', 401);
        }

        $user = $result['user'];
        ($this->session ?? new SessionService())->setUser(
            $user['id'],
            'wunschbesteller',
            $result['fairgateUserExists'],
            $result['fairgateStatus'],
        );

        return JsonResponse::success($response, [
            'user' => $user,
            'group' => 'wunschbesteller',
            'requiredPasswordReset' => (bool) ($user['required_password_reset'] ?? false),
            'firstAccess' => $result['firstAccess'],
            'fairgateStatus' => $result['fairgateStatus'],
            'fairgateUserExists' => $result['fairgateUserExists'],
            'childrenCount' => $result['childrenCount'],
            'adultsCount' => $result['adultsCount'],
            'salutation' => $result['salutation'],
        ]);
    }

    private static function createService(): ClientRegistrationLoginService
    {
        $tokens = new \App\Registration\Services\RegistrationTokenService();
        $users = new \App\Users\Data\UserRepository();

        return new ClientRegistrationLoginService(
            $tokens,
            $users,
            \App\Fairgate\Services\FairgateContactProviderFactory::create(),
            new FrontendConfigRepository(\App\Shared\Database\Database::getConnection()),
            new OrderRepository(\App\Shared\Database\Database::getConnection()),
        );
    }
}
