<?php

declare(strict_types=1);

use App\Configuration\Environment;
use App\Registration\Data\OrderRepository;
use App\Shared\Database\Database;
use App\Users\Data\UserRepository;
use Tests\Support\OrderItemImageFixture;

require dirname(__DIR__, 2) . '/vendor/autoload.php';
require __DIR__ . '/OrderItemImageFixture.php';
Environment::load();
if (getenv('APP_ENV') !== 'test' || getenv('DB_NAME') !== 'gaerngschee_integration') {
    throw new RuntimeException('Image fixtures are restricted to the integration database.');
}
$pdo = Database::getConnection();
$operation = $argv[1] ?? 'create';
if ($operation === 'cleanup') {
    $pdo->prepare('DELETE FROM users WHERE id = ? OR id = ?')->execute([$argv[2], $argv[3]]);
    exit;
}
if ($operation === 'inspect') {
    $statement = $pdo->prepare(
        'SELECT items.image_revision, images.id, images.mime_type, images.byte_size,
                SHA2(images.image_data, 256) AS checksum
         FROM order_items items LEFT JOIN order_item_images images ON images.order_item_id = items.id
         WHERE items.id = ?',
    );
    $statement->execute([$argv[2]]);
    echo json_encode($statement->fetch(), JSON_THROW_ON_ERROR);
    exit;
}
$suffix = bin2hex(random_bytes(8));
$users = new UserRepository($pdo);
$owner = $users->createUser("image-owner-$suffix@example.invalid", 'image-fixture-password', 'wunschbesteller');
$user = $users->createUser("image-user-$suffix@example.invalid", 'image-fixture-password', 'user');
$order = (new OrderRepository($pdo))->saveForYear($owner['id'], 2026, 'draft', 1, 0, [
    ['category' => 'gift', 'title' => 'Image fixture wish', 'description' => 'Image fixture description'],
]);
echo json_encode([
    'ownerId' => $owner['id'],
    'userId' => $user['id'],
    'userEmail' => $user['email'],
    'orderId' => $order['id'],
    'itemId' => $order['items'][0]['id'],
    'images' => array_map(static fn (string $type): string => base64_encode(OrderItemImageFixture::bytes($type)), ['png', 'jpeg', 'webp']),
], JSON_THROW_ON_ERROR);
