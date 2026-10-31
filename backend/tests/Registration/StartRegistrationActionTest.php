<?php

declare(strict_types=1);

namespace Tests\Registration;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\OrderRepository;
use App\Registration\Actions\StartRegistrationAction;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\RegistrationTokenService;
use App\Shared\Mail\EmailSenderInterface;
use Tests\Support\TestDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;
use Slim\Psr7\Stream;
use DateTimeImmutable;
use DateTimeZone;

final class StartRegistrationActionTest extends TestCase
{
    public function testAcceptsValidEmailAndLanguage(): void
    {
        $pdo = TestDatabase::create();
        $action = new StartRegistrationAction($this->service(), new RegistrationTokenService($pdo), $this->config($pdo, '2026-08-01'), new DateTimeImmutable('2026-08-25 12:00:00', new DateTimeZone('UTC')), new OrderRepository($pdo));

        $response = ($action)($this->request('person@example.com', 'de'), new Response());

        self::assertSame(202, $response->getStatusCode());
        self::assertSame(['sent' => true], json_decode((string) $response->getBody(), true));
    }

    public function testRejectsEmailBeforeCampaignStart(): void
    {
        $pdo = TestDatabase::create();
        $action = new StartRegistrationAction($this->service(), new RegistrationTokenService($pdo), $this->config($pdo, '2026-10-01'), new DateTimeImmutable('2026-08-25 12:00:00', new DateTimeZone('UTC')), new OrderRepository($pdo));

        $response = ($action)($this->request('person@example.com', 'de'), new Response());

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('CAMPAIGN_NOT_STARTED', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    public function testRejectsEmailAfterCampaignEnd(): void
    {
        $pdo = TestDatabase::create();
        $action = new StartRegistrationAction($this->service(), new RegistrationTokenService($pdo), $this->config($pdo, '2026-08-01', '2026-08-20'), new DateTimeImmutable('2026-08-25 12:00:00', new DateTimeZone('UTC')));

        $response = ($action)($this->request('person@example.com', 'de'), new Response());

        self::assertSame(403, $response->getStatusCode());
        self::assertSame('CAMPAIGN_ENDED', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    public function testRejectsUnsupportedLanguageBeforeCallingService(): void
    {
        $action = new StartRegistrationAction($this->service(), new RegistrationTokenService(TestDatabase::create()));

        $response = ($action)($this->request('person@example.com', 'fr'), new Response());

        self::assertSame(422, $response->getStatusCode());
        self::assertSame('UNSUPPORTED_LANGUAGE', json_decode((string) $response->getBody(), true)['error']['code']);
    }

    private function service(): AnmeldungService
    {
        return new AnmeldungService(
            new class () implements EmailSenderInterface {
                public function sendAnmeldung(string $recipient, \App\Registration\Services\AnmeldungMailVariant $variant, string $locale = 'de', ?string $loginUrl = null, ?array $wish = null): void
                {
                }
                public function sendOrderStatus(string $recipient, string $status, string $locale = 'de'): void
                {
                }
                public function sendUserCreated(string $recipient, string $temporaryPassword): void
                {
                }
                public function sendUserEmailChanged(string $recipient): void
                {
                }
                public function sendPasswordReset(string $recipient, string $resetUrl): void
                {
                }
                public function sendOrderConfirmation(string $recipient, array $order): void
                {
                }
                public function renderOrderConfirmation(array $order, string $mailStatus): array
                {
                    return [];
                }
                public function renderDeliveryNotification(array $order, string $deliveryUrl, string $qrDataUri): array
                {
                    return [];
                }
                public function renderFairgateReminder(string $fairgateUrl, string $status = 'not_found', ?string $documentEmail = null): array
                {
                    return [];
                }
                public function sendStoredEmail(string $recipient, string $subject, string $html, string $text): void
                {
                }
            },
        );
    }

    private function config(\PDO $pdo, string $startDate, string $endDate = '2026-12-31'): FrontendConfigRepository
    {
        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, description, access_group, update_group, label)
             VALUES (:id, :variable_name, :value, :description, :access_group, :update_group, :label)',
        )->execute([
            'id' => 'campaign-start-date',
            'variable_name' => 'campaign_start_date',
            'value' => json_encode($startDate, JSON_THROW_ON_ERROR),
            'description' => '',
            'access_group' => json_encode(['admin', 'wunschbesteller'], JSON_THROW_ON_ERROR),
            'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => '',
        ]);

        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, description, access_group, update_group, label)
             VALUES (:id, :variable_name, :value, :description, :access_group, :update_group, :label)',
        )->execute([
            'id' => 'campaign-end-date',
            'variable_name' => 'campaign_end_date',
            'value' => json_encode($endDate, JSON_THROW_ON_ERROR),
            'description' => '',
            'access_group' => json_encode(['admin', 'wunschbesteller'], JSON_THROW_ON_ERROR),
            'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => '',
        ]);

        $pdo->prepare(
            'INSERT INTO frontend_config (id, variable_name, value, description, access_group, update_group, label)
             VALUES (:id, :variable_name, :value, :description, :access_group, :update_group, :label)',
        )->execute([
            'id' => 'campaign-year',
            'variable_name' => 'campaign_year',
            'value' => json_encode('2026', JSON_THROW_ON_ERROR),
            'description' => '',
            'access_group' => json_encode(['admin', 'wunschbesteller'], JSON_THROW_ON_ERROR),
            'update_group' => json_encode(['admin'], JSON_THROW_ON_ERROR),
            'label' => '',
        ]);

        return new FrontendConfigRepository($pdo);
    }

    private function request(string $email, string $language): \Psr\Http\Message\ServerRequestInterface
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, json_encode(['email' => $email, 'language' => $language], JSON_THROW_ON_ERROR));
        rewind($stream);

        return (new \Slim\Psr7\Factory\ServerRequestFactory())
            ->createServerRequest('POST', '/public/start')
            ->withBody(new Stream($stream));
    }
}
