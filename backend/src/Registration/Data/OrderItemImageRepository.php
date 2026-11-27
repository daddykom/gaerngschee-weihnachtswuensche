<?php

declare(strict_types=1);

namespace App\Registration\Data;

use App\Registration\Services\OrderItemImageException;
use PDO;

final class OrderItemImageRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function state(string $orderId, string $itemId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT items.image_revision, images.id, images.mime_type, images.width,
                    images.height, images.byte_size, images.updated_at
             FROM order_items items
             LEFT JOIN order_item_images images ON images.order_item_id = items.id
             WHERE items.order_id = :order AND items.id = :item',
        );
        $statement->execute(['order' => $orderId, 'item' => $itemId]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new OrderItemImageException('ORDER_ITEM_NOT_FOUND', 404);
        }
        return [
            'revision' => (int) $row['image_revision'],
            'image' => $row['id'] === null ? null : [
                'id' => $row['id'],
                'mimeType' => $row['mime_type'],
                'width' => (int) $row['width'],
                'height' => (int) $row['height'],
                'byteSize' => (int) $row['byte_size'],
                'updatedAt' => $row['updated_at'],
            ],
        ];
    }

    public function image(string $orderId, string $itemId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT images.image_data, images.mime_type FROM order_item_images images
             JOIN order_items items ON items.id = images.order_item_id
             WHERE items.order_id = :order AND items.id = :item',
        );
        $statement->execute(['order' => $orderId, 'item' => $itemId]);
        $image = $statement->fetch();
        if ($image === false) {
            throw new OrderItemImageException('IMAGE_NOT_FOUND', 404);
        }
        return ['data' => $image['image_data'], 'mimeType' => $image['mime_type']];
    }

    /** Only images of published wishes may be read without administrator access. */
    public function publicImage(string $itemId, string $imageId): array
    {
        $statement = $this->pdo->prepare(
            "SELECT images.image_data, images.mime_type
             FROM order_item_images images
             INNER JOIN order_items items ON items.id = images.order_item_id
             INNER JOIN orders ON orders.id = items.order_id
             WHERE items.id = :item AND images.id = :image
               AND items.publication_status = 'approved' AND orders.status = 'definitive'",
        );
        $statement->execute(['item' => $itemId, 'image' => $imageId]);
        $image = $statement->fetch();
        if ($image === false) {
            throw new OrderItemImageException('IMAGE_NOT_FOUND', 404);
        }
        return ['data' => $image['image_data'], 'mimeType' => $image['mime_type']];
    }

    /** @param array{data: string, mimeType: string, width: int, height: int, byteSize: int} $image */
    public function replace(string $orderId, string $itemId, int $revision, array $image): array
    {
        return $this->change($orderId, $itemId, $revision, $image);
    }

    public function remove(string $orderId, string $itemId, int $revision): array
    {
        return $this->change($orderId, $itemId, $revision, null);
    }

    private function change(string $orderId, string $itemId, int $revision, ?array $image): array
    {
        $this->pdo->beginTransaction();
        try {
            $lock = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
            $item = $this->pdo->prepare(
                'SELECT image_revision FROM order_items WHERE id = :item AND order_id = :order' . $lock,
            );
            $item->execute(['item' => $itemId, 'order' => $orderId]);
            $current = $item->fetchColumn();
            if ($current === false) {
                throw new OrderItemImageException('ORDER_ITEM_NOT_FOUND', 404);
            }
            if ((int) $current !== $revision) {
                throw new OrderItemImageException('IMAGE_REVISION_CONFLICT', 409);
            }
            $this->pdo->prepare('DELETE FROM order_item_images WHERE order_item_id = ?')->execute([$itemId]);
            if ($image !== null) {
                $insert = $this->pdo->prepare(
                    'INSERT INTO order_item_images (id, order_item_id, image_data, mime_type, width, height, byte_size)
                     VALUES (:id, :item, :data, :mime, :width, :height, :size)',
                );
                $insert->bindValue('id', $this->uuid());
                $insert->bindValue('item', $itemId);
                $insert->bindValue('data', $image['data'], PDO::PARAM_LOB);
                $insert->bindValue('mime', $image['mimeType']);
                $insert->bindValue('width', $image['width'], PDO::PARAM_INT);
                $insert->bindValue('height', $image['height'], PDO::PARAM_INT);
                $insert->bindValue('size', $image['byteSize'], PDO::PARAM_INT);
                $insert->execute();
            }
            $update = $this->pdo->prepare(
                'UPDATE order_items SET image_revision = image_revision + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = :item AND order_id = :order',
            );
            $update->execute(['item' => $itemId, 'order' => $orderId]);
            $state = $this->state($orderId, $itemId);
            $this->pdo->commit();
            return $state;
        } catch (\Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $exception;
        }
    }

    private function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
