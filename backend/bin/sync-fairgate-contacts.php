<?php

declare(strict_types=1);

use App\Configuration\Environment;
use App\Fairgate\Data\FairgateContactRepository;
use App\Fairgate\Services\FairgateClient;
use App\Fairgate\Services\FairgateContactProviderFactory;
use App\Fairgate\Services\FairgateContactSyncService;
use App\Shared\Database\Database;

require __DIR__ . '/../vendor/autoload.php';

try {
    Environment::load();
    $provider = FairgateContactProviderFactory::create();
    if (!$provider instanceof FairgateClient) {
        fwrite(STDOUT, "Fairgate contact synchronization skipped: fake mode uses email-based profiles.\n");
        exit(0);
    }
    $service = new FairgateContactSyncService(
        new FairgateContactRepository(Database::getConnection()),
        $provider->fetchAllClientContacts(...),
    );
    $result = $service->run();
    printf(
        "Fairgate contacts read: %d, inserted: %d, updated: %d, deleted: %d\n",
        $result['read'],
        $result['inserted'],
        $result['updated'],
        $result['deleted'],
    );
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Fairgate contact synchronization failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
