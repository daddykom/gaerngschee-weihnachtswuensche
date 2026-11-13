<?php

require dirname(__DIR__) . '/vendor/autoload.php';
\App\Configuration\Environment::load();
require __DIR__ . '/Support/TestDatabase.php';
require __DIR__ . '/Support/RecordingEmailSender.php';
require __DIR__ . '/Support/FairgateTestTokens.php';

// Keep legacy global database access inside the isolated unit-test environment.
\App\Shared\Database\Database::setConnection(\Tests\Support\TestDatabase::create());
