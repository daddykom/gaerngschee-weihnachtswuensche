<?php

declare(strict_types=1);

namespace App\Configuration\Actions;

use App\Configuration\Data\FrontendConfigRepository;
use App\Registration\Services\CampaignAvailabilityService;
use App\Registration\Services\FulfillerAvailabilityService;
use App\Shared\Database\Database;
use App\Shared\Http\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ListPublicConfigurationAction
{
    public function __construct(
        private readonly ?FrontendConfigRepository $configs = null,
        private readonly ?FulfillerAvailabilityService $fulfillerAvailability = null,
        private readonly ?CampaignAvailabilityService $campaignAvailability = null,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $configs = $this->configs ?? new FrontendConfigRepository(Database::getConnection());

        $values = $configs->findValuesForGroup('wunschbesteller');
        $availability = ($this->fulfillerAvailability ?? new FulfillerAvailabilityService(
            Database::getConnection(),
            $configs,
        ))->status();
        $values[] = [
            'variableName' => 'fulfiller_availability_status',
            'value' => $availability,
        ];
        $campaignAvailability = ($this->campaignAvailability ?? new CampaignAvailabilityService(
            Database::getConnection(),
            $configs,
        ))->status();
        $values[] = [
            'variableName' => 'campaign_availability_status',
            'value' => $campaignAvailability,
        ];

        return JsonResponse::success($response, $values);
    }
}
