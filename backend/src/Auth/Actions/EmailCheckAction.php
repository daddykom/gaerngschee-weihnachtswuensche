<?php

declare(strict_types=1);

namespace App\Auth\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\RegistrationTokenService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Users\Data\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class EmailCheckAction
{
    public function __construct(
        private readonly ?UserRepository $users = null,
        private readonly ?FrontendConfigRepository $configs = null,
        private readonly ?OrderRepository $orders = null,
        private readonly ?RegistrationTokenService $tokens = null,
        private readonly ?AnmeldungService $anmeldung = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $data = JsonRequest::body($request);
        $email = JsonRequest::string($data, 'email', 254);
        if ($email === null || filter_var(trim($email), FILTER_VALIDATE_EMAIL) === false) {
            return JsonResponse::error($response, 'INVALID_EMAIL', 422);
        }

        $email = strtolower(trim($email));
        $users = $this->users ?? new UserRepository();
        $user = $users->findByEmail($email);
        if (is_array($user) && in_array($user['group'] ?? null, ['admin', 'user', 'wunschbesteller', 'wunscherfueller'], true)) {
            return JsonResponse::success($response, ['mode' => 'password']);
        }

        $configuration = $this->configs ?? new FrontendConfigRepository(Database::getConnection());
        $year = $configuration->findCampaignYear();
        $status = ($this->orders ?? new OrderRepository(Database::getConnection()))
            ->findStatusForEmailAndYear($email, $year);

        if (in_array($status, ['provisional', 'definitive'], true)) {
            try {
                $token = ($this->tokens ?? new RegistrationTokenService())->issue($email)['token'];
                $frontendBaseUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/');
                $loginUrl = $frontendBaseUrl . '/client-login?token=' . rawurlencode($token);
                ($this->anmeldung ?? new AnmeldungService(new \App\Shared\Mail\EmailSender()))
                    ->sendRegistrationLink($email, $loginUrl);
            } catch (Throwable $exception) {
                return JsonResponse::error($response, 'REQUEST_FAILED', 503);
            }

            return JsonResponse::success($response, [
                'mode' => 'email_sent',
                'processingYear' => $year,
            ], 202);
        }

        return JsonResponse::success($response, [
            'mode' => 'info',
            'processingYear' => $year,
        ]);
    }
}
