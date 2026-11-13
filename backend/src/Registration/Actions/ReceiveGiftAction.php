<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\GiftReceiptRepository;
use App\Registration\Services\GiftReceiptException;
use App\Registration\Services\GiftReceiptService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonRequest;
use App\Shared\Http\JsonResponse;
use App\Shared\Logging\ExceptionLogger;
use App\Shared\Mail\EmailSender;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ReceiveGiftAction
{
    public function __construct(private readonly ?GiftReceiptService $receipts = null, private readonly ?FrontendConfigRepository $config = null)
    {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args = []): ResponseInterface
    {
        $number = $args['giftNumber'] ?? null;
        if (!is_string($number) || preg_match('/^([1-9][0-9]{0,9})-([1-9][0-9]{0,9})$/D', $number, $parts) !== 1
            || (int) $parts[1] > 2147483647 || (int) $parts[2] > 2147483647) {
            return JsonResponse::error($response, 'INVALID_GIFT_NUMBER', 400);
        }
        $body = JsonRequest::body($request);
        $unreserved = $body['confirmUnreserved'] ?? false;
        $pickup = $body['confirmPickup'] ?? false;
        if (!is_bool($unreserved) || !is_bool($pickup)) {
            return JsonResponse::error($response, 'INVALID_RECEIPT_DATA', 422);
        }
        try {
            $service = $this->receipts;
            if ($service === null) {
                $emails = new EmailSender();
                $service = new GiftReceiptService(new GiftReceiptRepository(Database::getConnection()), $emails, $emails->renderPickupNotification(...));
            }
            $year = ($this->config ?? new FrontendConfigRepository(Database::getConnection()))->findCampaignYear();
            return JsonResponse::success($response, $service->receive($year, (int) $parts[1], (int) $parts[2], $unreserved, $pickup));
        } catch (GiftReceiptException $exception) {
            return JsonResponse::success($response, ['error' => ['code' => $exception->getMessage(), 'details' => $exception->result === null ? [] : ['result' => $exception->result]]], $exception->httpStatus);
        } catch (\Throwable $exception) {
            ExceptionLogger::log('Gift receipt failed', $exception);
            return JsonResponse::error($response, 'RECEIPT_FAILED', 500);
        }
    }
}
