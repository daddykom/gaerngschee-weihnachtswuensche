<?php

declare(strict_types=1);

namespace App\Registration\Services;

use App\Fairgate\Services\FairgateContactProvider;
use App\Registration\Data\FairgateRegistrationRequestRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

final class FairgateRegistrationBatchService
{
    private const CHECK_INTERVAL = 'PT12H';

    public function __construct(
        private readonly FairgateRegistrationRequestRepository $requests,
        private readonly FairgateContactProvider $fairgate,
        private readonly AnmeldungService $anmeldung,
        private readonly ?DateTimeImmutable $now = null,
    ) {
    }

    /** @return array{checked: int, notified: int, failed: int} */
    public function run(): array
    {
        $now = $this->now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $result = ['checked' => 0, 'notified' => 0, 'failed' => 0];

        foreach ($this->requests->findDue($now, new DateInterval(self::CHECK_INTERVAL)) as $request) {
            try {
                $found = $this->fairgate->hasContactByEmail(
                    (string) $request['email'],
                    ClientRegistrationLoginService::MEMBERSHIP,
                );
                $result['checked']++;

                if (!$found) {
                    $this->requests->markChecked((string) $request['id'], $now);
                    continue;
                }

                $startUrl = rtrim(getenv('FRONTEND_BASE_URL') ?: 'http://localhost:4200', '/') . '/start';
                $this->anmeldung->sendFairgateRegistrationAvailable((string) $request['email'], $startUrl);
                $this->requests->markNotificationSent((string) $request['id'], $now, $now);
                $result['notified']++;
            } catch (Throwable $exception) {
                $result['failed']++;
                error_log(sprintf(
                    'Fairgate registration batch failed: request=%s error=%s',
                    (string) ($request['id'] ?? ''),
                    $exception->getMessage(),
                ));
            }
        }

        return $result;
    }
}
