<?php
declare(strict_types=1);

foreach ([
    __DIR__ . '/../backend/vendor/autoload.php',
    '/var/www/html/vendor/autoload.php',
] as $autoload) {
    if (is_file($autoload)) {
        require_once $autoload;
        break;
    }
}

if (!class_exists(\App\Configuration\Environment::class)) {
    throw new RuntimeException('Backend autoloader could not be found.');
}

\App\Configuration\Environment::load();

return [
    'paths' => [
        'migrations' => __DIR__ . '/migrations',
        'seeds' => getenv('PHINX_SEED_PATH') ?: __DIR__ . '/seeds',
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'development' => [
            'adapter' => 'mysql',
            'host' => getenv('DB_HOST') ?: 'localhost',
            'name' => getenv('DB_NAME') ?: 'gaerngschee_weihnachtswuensche',
            'user' => getenv('DB_USER') ?: 'root',
            'pass' => getenv('DB_PASS') ?: '',
            'port' => getenv('DB_PORT') ?: '3306',
            'charset' => 'utf8mb4',
        ],
        'test' => [
            'adapter' => 'mysql',
            'host' => getenv('DB_HOST') ?: 'localhost',
            'name' => getenv('DB_TEST_NAME') ?: 'gaerngschee_test',
            'user' => getenv('DB_USER') ?: 'root',
            'pass' => getenv('DB_PASS') ?: '',
            'port' => getenv('DB_PORT') ?: '3306',
            'charset' => 'utf8mb4',
        ],
        'production' => [
            'adapter' => 'mysql',
            'host' => getenv('DB_HOST'),
            'name' => getenv('DB_NAME'),
            'user' => getenv('DB_USER'),
            'pass' => getenv('DB_PASS'),
            'port' => getenv('DB_PORT') ?: '3306',
            'charset' => 'utf8mb4',
        ],
    ],
];
