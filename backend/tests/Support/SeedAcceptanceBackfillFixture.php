<?php

declare(strict_types=1);

use App\Configuration\Environment;
use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Users\Data\UserRepository;

require dirname(__DIR__, 2) . '/vendor/autoload.php';
Environment::load();
if (getenv('APP_ENV') !== 'test' || getenv('DB_NAME') !== 'gaerngschee_integration') {
    throw new RuntimeException('Acceptance backfill fixtures are restricted to the integration database.');
}
$pdo = Database::getConnection();
if (($argv[1] ?? '') === 'inspect') {
    $order = $pdo->prepare('SELECT status, acceptance_email_sent_at FROM orders WHERE id = ?');
    $order->execute([$argv[2]]);
    $pending = $pdo->prepare("SELECT COUNT(*) FROM email_queue WHERE reference_type = 'order' AND reference_id = ? AND email_type = 'order_acceptance'");
    $pending->execute([$argv[2]]);
    echo json_encode(['order' => $order->fetch(), 'pending' => (int) $pending->fetchColumn()], JSON_THROW_ON_ERROR);
    exit(0);
}
$email = $argv[1];
$year = (int) $argv[2];
$user = (new UserRepository($pdo))->createUser($email, 'fixture-password', 'wunschbesteller');
$order = (new OrderRepository($pdo))->saveForYear($user['id'], $year, 'definitive', 1, 0, [['category' => 'gift', 'description' => 'Legacy coat', 'reason' => 'Winter']]);
$pdo->prepare('UPDATE orders SET order_number = 1 WHERE id = ?')->execute([$order['id']]);
$pdo->prepare("UPDATE order_items SET publication_status = 'approved', status = 'approved', item_number = 1 WHERE order_id = ?")->execute([$order['id']]);
echo json_encode(['orderId' => $order['id'], 'userId' => $user['id'], 'email' => $email], JSON_THROW_ON_ERROR);
