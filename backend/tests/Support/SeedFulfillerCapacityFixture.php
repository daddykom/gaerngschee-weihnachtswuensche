<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/vendor/autoload.php';

$pdo = new PDO(
    'mysql:host=' . getenv('DB_HOST') . ';dbname=' . getenv('DB_NAME') . ';port=' . getenv('DB_PORT'),
    getenv('DB_USER'),
    getenv('DB_PASS'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$pdo->beginTransaction();
try {
    $pdo->exec(
        "INSERT IGNORE INTO users (id, email, password, `group`, required_password_reset)
         VALUES
            ('integration-capacity-user-1', 'capacity-user-1@example.com', 'fixture-password', 'user', 0),
            ('integration-capacity-user-2', 'capacity-user-2@example.com', 'fixture-password', 'user', 0)",
    );
    $pdo->exec(
        "INSERT IGNORE INTO orders (id, user_id, year, status, order_number, current_text)
         VALUES
            ('integration-capacity-order-1', 'integration-capacity-user-1', 2026, 'definitive', 9001, 'Familie 1'),
            ('integration-capacity-order-2', 'integration-capacity-user-2', 2026, 'definitive', 9002, 'Familie 2')",
    );
    $pdo->exec(
        "INSERT IGNORE INTO order_items
            (id, order_id, item_number, category, original_description, current_description,
             status, publication_status, fulfillment_status)
         VALUES
            ('integration-capacity-item-1', 'integration-capacity-order-1', 1, 'gift', 'Wunsch 1', 'Wunsch 1', 'approved', 'approved', 'available'),
            ('integration-capacity-item-2', 'integration-capacity-order-2', 1, 'gift', 'Wunsch 2', 'Wunsch 2', 'approved', 'approved', 'available')",
    );
    $pdo->commit();
} catch (Throwable $exception) {
    $pdo->rollBack();
    throw $exception;
}
