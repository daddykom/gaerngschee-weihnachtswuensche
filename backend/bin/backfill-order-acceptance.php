<?php

declare(strict_types=1);

use App\Configuration\Data\FrontendConfigRepository;
use App\Configuration\Environment;
use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;

$usage = "Usage: php bin/backfill-order-acceptance.php --year=2026 [--send]\n"
    . "Default: read-only preview. --send queues missing acceptance emails for the existing order mail batch.\n";
if ($argc === 2 && $argv[1] === '--help') {
    fwrite(STDOUT, $usage);
    exit(0);
}
$year = null;
$send = false;
foreach (array_slice($argv, 1) as $argument) {
    if (preg_match('/^--year=([1-9][0-9]{0,3})$/D', $argument, $matches) === 1 && $year === null) {
        $year = (int) $matches[1];
    } elseif ($argument === '--send' && !$send) {
        $send = true;
    } else {
        fwrite(STDERR, 'Invalid or duplicate argument: ' . $argument . PHP_EOL . $usage);
        exit(1);
    }
}
if ($year === null) {
    fwrite(STDERR, 'An explicit campaign year is required.' . PHP_EOL . $usage);
    exit(1);
}

require __DIR__ . '/../vendor/autoload.php';

try {
    Environment::load();
    $pdo = Database::getConnection();
    $orders = new OrderRepository($pdo);
    $candidates = $orders->findAcceptanceBackfillCandidates($year);
    printf("Campaign year: %d. Eligible wish lists: %d. Unique recipients: %d.\n", $year, count($candidates), count(array_unique(array_column($candidates, 'email'))));
    if (!$send) {
        fwrite(STDOUT, "Preview only. No data changed and no emails sent. Use --send to queue these notifications.\n");
        exit(0);
    }

    $config = new FrontendConfigRepository($pdo);
    foreach (['pickup_date', 'pickup_location'] as $key) {
        $value = $config->findValueByVariableName($key);
        if (!is_string($value) || trim($value) === '') {
            throw new RuntimeException('Configure pickup_date and pickup_location before queueing acceptance emails.');
        }
    }
    $queued = 0;
    foreach ($candidates as $candidate) {
        $queued += $orders->enqueueAcceptanceBackfill($candidate['id'], $year) ? 1 : 0;
    }
    printf("Queued: %d. Skipped after recheck: %d.\n", $queued, count($candidates) - $queued);
    fwrite(STDOUT, "No emails sent by this script. The scheduled order mail batch sends the queued notifications.\n");
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Acceptance backfill failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
