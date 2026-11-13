<?php

declare(strict_types=1);

namespace App\Registration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Data\GiftReceiptRepository;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class GiftReceiptLookupAction
{
    public function __construct(
        private readonly ?GiftReceiptRepository $receipts = null,
        private readonly ?FrontendConfigRepository $config = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args = []): ResponseInterface
    {
        $number = $args['giftNumber'] ?? null;
        if (!is_string($number) || preg_match('/^([1-9][0-9]{0,9})-([1-9][0-9]{0,9})$/D', $number, $parts) !== 1
            || (int) $parts[1] > 2147483647 || (int) $parts[2] > 2147483647) {
            return JsonResponse::error($response, 'INVALID_GIFT_NUMBER', 400);
        }

        $config = $this->config ?? new FrontendConfigRepository(Database::getConnection());
        $year = $config->findCampaignYear();
        $receipts = $this->receipts ?? new GiftReceiptRepository(Database::getConnection());
        $result = $receipts->findByNumber($year, (int) $parts[1], (int) $parts[2]);

        return $result === null
            ? JsonResponse::error($response, 'GIFT_NOT_FOUND', 404)
            : JsonResponse::success($response, ['campaignYear' => $year, ...$result]);
    }
}
