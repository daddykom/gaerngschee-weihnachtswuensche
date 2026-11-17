<?php

declare(strict_types=1);

use App\Configuration\Environment;
use App\Registration\Data\OrderRepository;
use App\Registration\Services\OrderStatus;
use App\Shared\Database\Database;
use App\Users\Data\UserRepository;

require dirname(__DIR__, 2) . '/vendor/autoload.php';
Environment::load();
if (getenv('APP_ENV') !== 'test' || getenv('DB_NAME') !== 'gaerngschee_integration') {
    throw new RuntimeException('Statistics fixtures are restricted to the integration database.');
}
$pdo = Database::getConnection();
$users = new UserRepository($pdo);
$orders = new OrderRepository($pdo);
$year = (int) $argv[1];
$prefix = $argv[2];
$userIds = [];
$fulfillment = ['available', 'pending_confirmation', 'reserved', 'received', 'completed', 'available', 'reserved'];
$publication = ['draft', 'submitted', 'rejected', 'approved'];
foreach (OrderStatus::all() as $index => $status) {
    $user = $users->createUser($prefix . '-' . $index . '@example.com', 'fixture-password', 'wunschbesteller');
    $userIds[] = $user['id'];
    $items = [['category' => 'gift', 'description' => 'Statistics gift', 'reason' => 'Winter']];
    if ($index === 0) {
        $items[] = ['category' => 'voucher', 'description' => 'Statistics voucher', 'reason' => 'Winter'];
    }
    $order = $orders->saveForYear($user['id'], $year, $status, 1, 0, $items);
    $pdo->prepare('UPDATE order_items SET fulfillment_status = ?, publication_status = ? WHERE id = ?')->execute([
        $fulfillment[$index], $publication[$index % count($publication)], $order['items'][0]['id'],
    ]);
}
$user = $users->createUser($prefix . '-empty@example.com', 'fixture-password', 'wunschbesteller');
$userIds[] = $user['id'];
$orders->saveForYear($user['id'], $year, 'draft', 1, 0, []);
$orders->saveForYear($user['id'], $year - 1, 'draft', 1, 0, [['category' => 'gift', 'description' => 'Other year']]);
echo json_encode(['userIds' => $userIds], JSON_THROW_ON_ERROR);
