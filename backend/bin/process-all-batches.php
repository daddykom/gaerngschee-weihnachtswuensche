<?php

declare(strict_types=1);

/**
 * Run all scheduled backend batches in sequence.
 *
 * The individual scripts remain available for manual execution and focused
 * operations. This entry point is intended for the single production cron job.
 */
$lockPath = sys_get_temp_dir() . '/gaerngschee-batches-' . hash('sha256', __DIR__) . '.lock';
$lock = @fopen($lockPath, 'c');
if ($lock === false) {
    fwrite(STDERR, "Could not open the batch runner lock.\n");
    exit(1);
}
if (!flock($lock, LOCK_EX | LOCK_NB, $wouldBlock)) {
    fclose($lock);
    if ($wouldBlock) {
        fwrite(STDOUT, "Batch runner skipped: another run is already active.\n");
        exit(0);
    }
    fwrite(STDERR, "Could not acquire the batch runner lock.\n");
    exit(1);
}

$batches = [
    'fairgate contacts' => __DIR__ . '/sync-fairgate-contacts.php',
    'fairgate registrations' => __DIR__ . '/process-fairgate-registrations.php',
    'orders' => __DIR__ . '/process-orders.php',
];

$failed = false;
$contactsFailed = false;
foreach ($batches as $name => $script) {
    if ($name === 'fairgate registrations' && $contactsFailed) {
        fwrite(STDERR, "Skipping fairgate registrations: contact synchronization failed.\n");
        continue;
    }
    printf("Starting %s batch...\n", $name);
    passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script), $exitCode);
    if ($exitCode !== 0) {
        fprintf(STDERR, "%s batch failed with exit code %d.\n", ucfirst($name), $exitCode);
        $failed = true;
        if ($name === 'fairgate contacts') {
            $contactsFailed = true;
        }
        continue;
    }
    printf("Finished %s batch.\n", $name);
}

// Keep the lock file: unlinking it could let another process lock a new inode.
fclose($lock);
exit($failed ? 1 : 0);
