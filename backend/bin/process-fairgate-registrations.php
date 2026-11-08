<?php

declare(strict_types=1);

use App\Configuration\Environment;
use App\Fairgate\Services\FairgateContactProviderFactory;
use App\Registration\Data\FairgateRegistrationRequestRepository;
use App\Registration\Services\AnmeldungService;
use App\Registration\Services\FairgateRegistrationBatchService;
use App\Shared\Database\Database;
use App\Shared\Mail\EmailSender;

require __DIR__ . '/../vendor/autoload.php';
Environment::load();

try {
    $pdo = Database::getConnection();
    $service = new FairgateRegistrationBatchService(
        new FairgateRegistrationRequestRepository($pdo),
        FairgateContactProviderFactory::create(),
        new AnmeldungService(new EmailSender()),
    );
    $result = $service->run();
    printf(
        "Fairgate registrations checked: %d, notifications sent: %d, failed: %d\n",
        $result['checked'],
        $result['notified'],
        $result['failed'],
    );
    exit($result['failed'] > 0 ? 1 : 0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Fairgate registration batch initialization failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
