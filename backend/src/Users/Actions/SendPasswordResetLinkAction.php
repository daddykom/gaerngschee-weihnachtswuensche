<?php

declare(strict_types=1);

namespace App\Users\Actions;

use App\Auth\Services\PasswordResetTokenService;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use App\Shared\Mail\EmailSender;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Data\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class SendPasswordResetLinkAction
{
    public function __construct(
        private readonly ?UserRepository $users = null,
        private readonly ?PasswordResetTokenService $tokens = null,
        private readonly ?EmailSenderInterface $emails = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $userId = (string) ($args['userId'] ?? '');
        $users = $this->users ?? new UserRepository();
        $user = $users->findById($userId);
        if ($user === null) {
            return JsonResponse::error($response, 'NOT_FOUND', 404);
        }

        try {
            $token = ($this->tokens ?? new PasswordResetTokenService())->issue($userId)['token'];
            $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
            ($this->emails ?? new EmailSender())->sendPasswordReset(
                (string) $user['email'],
                $frontendBaseUrl . '/password-reset?token=' . rawurlencode($token)
                    . '&email=' . rawurlencode((string) $user['email']),
            );
        } catch (Throwable $exception) {
            ExceptionLogger::log('Admin password reset email delivery failed', $exception);
            return JsonResponse::error($response, 'PASSWORD_RESET_REQUEST_FAILED', 503);
        }

        return JsonResponse::success($response, ['emailSentTo' => $user['email']]);
    }
}
