<?php

declare(strict_types=1);

/**
 * Run all scheduled backend batches in sequence.
 *
 * The individual scripts remain available for manual execution and focused
 * operations. This entry point is intended for the single production cron job.
 */
$batches = [
    'orders' => __DIR__ . '/process-orders.php',
    'fairgate registrations' => __DIR__ . '/process-fairgate-registrations.php',
];

$failed = false;
foreach ($batches as $name => $script) {
    printf("Starting %s batch...\n", $name);
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script), $exitCode);
    if ($exitCode !== 0) {
        fprintf(STDERR, "%s batch failed with exit code %d.\n", ucfirst($name), $exitCode);
        $failed = true;
        continue;
    }
    printf("Finished %s batch.\n", $name);
}

exit($failed ? 1 : 0);
