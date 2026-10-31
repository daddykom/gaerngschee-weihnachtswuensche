<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Actions\StartFulfillerRegistrationAction;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\FulfillerRegistrationLoginService;
use App\Registration\Services\RegistrationTokenService;
use App\Shared\Mail\EmailSenderInterface;
use App\Users\Data\UserRepository;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Slim\Psr7\Stream;
use Tests\Support\TestDatabase;

final class FulfillerRegistrationTest extends TestCase
{
    public function testRequiresPrivacyConsent(): void
    {
        $pdo = TestDatabase::create();
        $action = new StartFulfillerRegistrationAction(
            $this->anmeldung(),
            new RegistrationTokenService($pdo),
            $this->config($pdo),
            null,
        );

        $response = ($action)($this->request(false), new Response());

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('PRIVACY_CONSENT_REQUIRED', json_decode((string) $response->getBody(), true)['error']['code']);
        self::assertSame(0, (int) $pdo->query('SELECT COUNT(*) FROM registration_tokens')->fetchColumn());
    }

    public function testIssuesFulfillerTokenAndLogsInWithoutPassword(): void
    {
        $pdo = TestDatabase::create();
        $action = new StartFulfillerRegistrationAction(
            $this->anmeldung(),
            new RegistrationTokenService($pdo),
            $this->config($pdo),
            null,
        );

        $response = ($action)($this->request(true), new Response());
        self::assertSame(202, $response->getStatusCode());
        self::assertSame('fulfiller', $pdo->query('SELECT purpose FROM registration_tokens')->fetchColumn());
        self::assertNotNull($pdo->query('SELECT privacy_accepted_at FROM registration_tokens')->fetchColumn());

        $tokenService = new RegistrationTokenService($pdo);
        $token = (new RegistrationTokenService($pdo))->issue('other@example.com', null, RegistrationTokenService::FULFILLER)['token'];
        $result = (new FulfillerRegistrationLoginService($tokenService, new UserRepository($pdo)))->login($token);

        self::assertNotNull($result);
        self::assertSame('wunscherfueller', $result['user']['group']);
        self::assertSame('other@example.com', $result['user']['email']);
    }

    private function request(bool $privacyAccepted): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode([
            'email' => 'giver@example.com',
            'language' => 'de',
            'privacyAccepted' => $privacyAccepted,
        ], JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new ServerRequestFactory())
            ->createServerRequest('POST', '/public/fulfiller-start')
            ->withBody(new Stream($stream));
    }

    private function anmeldung(): AnmeldungService
    {
        return new AnmeldungService(new class () implements EmailSenderInterface {
            public function sendAnmeldung(string $recipient, \App\Registration\Services\AnmeldungMailVariant $variant, string $locale = 'de', ?string $loginUrl = null): void {}
            public function sendOrderStatus(string $recipient, string $status, string $locale = 'de'): void {}
            public function sendUserCreated(string $recipient, string $temporaryPassword): void {}
            public function sendUserEmailChanged(string $recipient): void {}
            public function sendPasswordReset(string $recipient, string $resetUrl): void {}
            public function sendOrderConfirmation(string $recipient, array $order): void {}
            public function renderOrderConfirmation(array $order, string $mailStatus): array { return []; }
            public function renderDeliveryNotification(array $order, string $deliveryUrl, string $qrDataUri): array { return []; }
            public function renderFairgateReminder(string $fairgateUrl, string $status = 'not_found', ?string $documentEmail = null): array { return []; }
            public function sendStoredEmail(string $recipient, string $subject, string $html, string $text): void {}
        });
    }

    private function config(\PDO $pdo): FrontendConfigRepository
    {
        foreach ([
            ['campaign-start-date', 'campaign_start_date', '2026-08-01'],
            ['campaign-end-date', 'campaign_end_date', '2026-12-31'],
        ] as [$id, $name, $value]) {
            $pdo->prepare(
                'INSERT INTO frontend_config (id, variable_name, value, description, access_group, update_group, label) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )->execute([$id, $name, json_encode($value, JSON_THROW_ON_ERROR), '', '[]', '[]', '']);
        }

        return new FrontendConfigRepository($pdo);
    }

    private function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('2026-08-25 12:00:00', new DateTimeZone('UTC'));
    }
}
