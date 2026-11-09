<?php

declare(strict_types=1);

namespace App\Shared\Mail;

use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use App\Registration\Services\AnmeldungMailVariant;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

final class EmailTestAction
{
    /** @var array<string, array{fields: list<array{key: string, type: string, required: bool}>}> */
    private const TEMPLATES = [
        'client-order' => ['fields' => [
            ['key' => 'loginUrl', 'type' => 'url', 'required' => true],
            ['key' => 'campaignYear', 'type' => 'number', 'required' => true],
        ]],
        'fulfiller-reservation' => ['fields' => [
            ['key' => 'loginUrl', 'type' => 'url', 'required' => true],
            ['key' => 'wishNumber', 'type' => 'text', 'required' => true],
            ['key' => 'wishDescription', 'type' => 'textarea', 'required' => true],
        ]],
        'fairgate-registration-required' => ['fields' => [
            ['key' => 'fairgateUrl', 'type' => 'url', 'required' => true],
        ]],
        'fairgate-registration-available' => ['fields' => [
            ['key' => 'startUrl', 'type' => 'url', 'required' => true],
        ]],
        'user-created' => ['fields' => [
            ['key' => 'loginUrl', 'type' => 'url', 'required' => true],
            ['key' => 'temporaryPassword', 'type' => 'text', 'required' => true],
        ]],
        'user-email-changed' => ['fields' => [
            ['key' => 'loginUrl', 'type' => 'url', 'required' => true],
        ]],
        'password-reset' => ['fields' => [
            ['key' => 'resetUrl', 'type' => 'url', 'required' => true],
        ]],
        'order-confirmation-saved' => ['fields' => [
            ['key' => 'year', 'type' => 'number', 'required' => true],
            ['key' => 'loginUrl', 'type' => 'url', 'required' => true],
        ]],
        'order-confirmation-changes_requested' => ['fields' => [
            ['key' => 'year', 'type' => 'number', 'required' => true],
            ['key' => 'loginUrl', 'type' => 'url', 'required' => true],
        ]],
    ];

    public function __construct(private readonly ?EmailSender $emails = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        if ($request->getMethod() === 'GET') {
            return JsonResponse::success($response, ['templates' => $this->templateList()]);
        }

        try {
            $data = JsonRequest::body($request);
            $recipient = JsonRequest::string($data, 'recipient', 254);
            $template = JsonRequest::string($data, 'template', 80);
            $parameters = $data['parameters'] ?? null;
            if ($recipient === null || filter_var($recipient, FILTER_VALIDATE_EMAIL) === false
                || $template === null || !isset(self::TEMPLATES[$template]) || !is_array($parameters)) {
                return JsonResponse::error($response, 'INVALID_EMAIL_TEST_DATA', 422);
            }

            $this->validateParameters($template, $parameters);
            ($this->emails ?? new EmailSender())->sendTestEmail($recipient, $template, $parameters);

            return JsonResponse::success($response, ['emailSentTo' => strtolower(trim($recipient))]);
        } catch (\InvalidArgumentException) {
            return JsonResponse::error($response, 'INVALID_EMAIL_TEST_DATA', 422);
        } catch (EmailDeliveryException $exception) {
            ExceptionLogger::log('Email test delivery failed', $exception);
            return JsonResponse::error($response, 'EMAIL_DELIVERY_FAILED', 503);
        } catch (Throwable $exception) {
            ExceptionLogger::log('Email test failed', $exception);
            return JsonResponse::error($response, 'EMAIL_TEST_FAILED', 500);
        }
    }

    /** @return list<array{id: string, fields: list<array{key: string, type: string, required: bool}>}> */
    private function templateList(): array
    {
        return array_map(
            static fn (string $id, array $definition): array => ['id' => $id, 'fields' => $definition['fields']],
            array_keys(self::TEMPLATES),
            array_values(self::TEMPLATES),
        );
    }

    /** @param array<string, mixed> $parameters */
    private function validateParameters(string $template, array $parameters): void
    {
        foreach (self::TEMPLATES[$template]['fields'] as $field) {
            $value = $parameters[$field['key']] ?? null;
            if ($field['required'] && (!is_scalar($value) || trim((string) $value) === '')) {
                throw new \InvalidArgumentException('Missing email test parameter.');
            }
        }
    }
}
