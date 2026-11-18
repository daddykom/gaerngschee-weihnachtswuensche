<?php

declare(strict_types=1);

use App\Configuration\Environment;
use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Users\Data\UserRepository;

require dirname(__DIR__, 2) . '/vendor/autoload.php';
Environment::load();
if (getenv('APP_ENV') !== 'test' || getenv('DB_NAME') !== 'gaerngschee_integration') {
    throw new RuntimeException('Reminder fixtures are restricted to the integration database.');
}
$pdo = Database::getConnection();
$recipient = $argv[1];
$user = (new UserRepository($pdo))->createUser('owner-' . $recipient, 'fixture-password', 'wunschbesteller');
$order = (new OrderRepository($pdo))->saveForYear($user['id'], (int) $argv[2], 'definitive', 1, 0, [
    ['category' => 'gift', 'title' => 'Open ball', 'description' => 'Outstanding red ball'],
    ['category' => 'gift', 'title' => 'Open book', 'description' => 'Outstanding picture book'],
    ['category' => 'gift', 'title' => 'Received gift', 'description' => 'Already received gift'],
    ['category' => 'gift', 'title' => 'Pending gift', 'description' => 'Unconfirmed gift'],
]);
$number = random_int(1000000, 2000000000);
$pdo->prepare('UPDATE orders SET order_number = ? WHERE id = ?')->execute([$number, $order['id']]);
foreach ($order['items'] as $index => $item) {
    $status = ['reserved', 'reserved', 'received', 'pending_confirmation'][$index];
    $pdo->prepare("UPDATE order_items SET publication_status = 'approved', status = 'approved',
        item_number = ?, fulfillment_status = ?, fulfiller_email = ?, received_at = ? WHERE id = ?")
        ->execute([$index + 1, $status, $recipient, $status === 'received' ? '2026-01-01 12:00:00' : null, $item['id']]);
}
echo json_encode(['userId' => $user['id'], 'orderNumber' => $number], JSON_THROW_ON_ERROR);
