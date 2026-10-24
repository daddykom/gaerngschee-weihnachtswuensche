<?php

declare(strict_types=1);

namespace App\Users\Actions;

use App\Users\Data\UserRepository;
use App\Shared\Mail\EmailSender;
use App\Shared\Mail\EmailSenderInterface;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class UpdateUserAction
{
    public function __construct(
        private readonly ?UserRepository $users = null,
        private readonly ?EmailSenderInterface $emails = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $userId = (string) ($args['userId'] ?? '');
        $actor = $request->getAttribute('user');
        if (!$this->isAdmin($actor) && (!is_array($actor) || ($actor['id'] ?? null) !== $userId)) {
            return JsonResponse::error($response, 'NOT_FOUND', 404);
        }

        $repository = $this->users ?? new UserRepository();
        $current = $repository->findById($userId);
        if ($current === null || in_array($current['group'], ['wunschbesteller', 'wunscherfueller'], true)) {
            return JsonResponse::error($response, 'NOT_FOUND', 404);
        }

        $data = JsonRequest::body($request);
        if (!$this->isAdmin($actor) && (array_key_exists('group', $data) || array_key_exists('required_password_reset', $data))) {
            return JsonResponse::error($response, 'INVALID_USER_DATA', 422);
        }

        $email = array_key_exists('email', $data) ? JsonRequest::string($data, 'email', 254) : $current['email'];
        $email = $email === null ? null : trim($email);
        $group = array_key_exists('group', $data) ? JsonRequest::string($data, 'group') : $current['group'];
        $reset = array_key_exists('required_password_reset', $data) && is_bool($data['required_password_reset'])
            ? $data['required_password_reset']
            : (array_key_exists('required_password_reset', $data) ? null : (bool) $current['required_password_reset']);
        if ($email === null || filter_var($email, FILTER_VALIDATE_EMAIL) === false || !is_string($group) || !in_array($group, ['admin', 'user'], true) || $reset === null) {
            return JsonResponse::error($response, 'INVALID_USER_DATA', 422);
        }

        if ($email !== $current['email'] && $repository->findByEmail($email) !== null) {
            return JsonResponse::error($response, 'EMAIL_ALREADY_REGISTERED', 409);
        }

        try {
            $user = $repository->updateUser($userId, $email, $group, $reset);
            if ($user === null) {
                return JsonResponse::error($response, 'NOT_FOUND', 404);
            }
            if ($user['email'] !== $current['email']) {
                ($this->emails ?? new EmailSender())->sendUserEmailChanged($user['email']);
            }
        } catch (Throwable $exception) {
            ExceptionLogger::log('User update or notification failed', $exception);
            return JsonResponse::error($response, 'USER_UPDATE_FAILED', 500);
        }

        $result = ['user' => $user];
        if ($user['email'] !== $current['email']) {
            $result['emailSentTo'] = $user['email'];
        }

        return JsonResponse::success($response, $result);
    }

    private function isAdmin(mixed $actor): bool
    {
        return is_array($actor) && ($actor['group'] ?? null) === 'admin';
    }
}
