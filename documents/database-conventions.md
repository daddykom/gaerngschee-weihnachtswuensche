# Database Conventions

## Overview

Database schema management using MariaDB with Phinx migrations.

## Phinx Migration Tool

[Phinx](https://phinx.org/) is used for database migrations. It allows version-controlled schema changes that can be rolled back.

### Installation

```bash
cd backend
composer require robmorgan/phinx
composer require --dev phpunit/phpunit
```

### Project Structure

```
db/
├── phinx.php                    # Phinx configuration
├── migrations/                  # Database migrations
│   ├── 20260614080000_create_registrations_table.php
│   ├── 20260614081000_create_children_table.php
│   └── ...
└── seeds/
    └── integration/            # Fixtures for integration tests
```

## Phinx Configuration

### db/phinx.php

```php
<?php
declare(strict_types=1);

return [
    'paths' => [
        'migrations' => __DIR__ . '/migrations',
        'seeds' => __DIR__ . '/seeds',
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'development' => [
            'adapter' => 'mysql',
            'host' => getenv('DB_HOST') ?: 'localhost',
            'name' => getenv('DB_NAME') ?: 'gaerngschee_dev',
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
```

## Commands

| Command | Description |
|---------|-------------|
| `phinx create <name>` | Create new migration |
| `phinx migrate` | Run all pending migrations |
| `phinx rollback` | Rollback last migration |
| `phinx status` | Show migration status |
| `phinx seed:run -e <environment>` | Run seeds for specific environment |
| `phinx break` | Rollback all migrations |

## Migration Example

```php
<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateRegistrationsTable extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('registrations', ['id' => false, 'primary_key' => 'id']);
        $table->addColumn('id', 'uuid')
              ->addColumn('status', 'string', ['limit' => 50])
              ->addColumn('eligibility_status', 'string', ['limit' => 50])
              ->addColumn('qr_code', 'string', ['limit' => 255])
              ->addColumn('pickup_confirmed', 'boolean', ['default' => false])
              ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
              ->addColumn('updated_at', 'timestamp', ['update' => 'CURRENT_TIMESTAMP'])
              ->create();
    }
}
```

## Seed Subdirectories

### integration/

Seeders for the isolated integration environment. This directory may contain
test-only fixtures that must not be loaded in Development, Pre-Production or
Production.

### Seed Idempotency

Integration seeders must not overwrite existing test data unexpectedly. Base
application data is created by migrations and is not created by seeders.

## Docker Integration

For local development with Docker:

```yaml
# docker-compose.yml
services:
  db:
    image: mariadb:10.11
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: gaerngschee_dev
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

## Environment Variables

```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gaerngschee_dev
DB_TEST_NAME=gaerngschee_test
DB_USER=root
DB_PASS=root
```

## Coding Standards

### Wish images

`order_item_images` stores the optional image for an existing wish separately
from `order_items`. A unique `order_item_id` allows at most one image per
wish; deleting the wish also deletes its image through a cascading foreign key.

The image bytes are stored in `image_data` as `MEDIUMBLOB`, not as Base64.
`mime_type`, `width`, `height` and `byte_size` describe the stored image.
UUID `id` and `created_at` / `updated_at` follow the usual table conventions.
Existing wishes require no image row and are not changed by the migration.

`order_items.image_revision` starts at zero and increases on every image upload
or removal, including removal when no image is present. The value survives image
deletion so an old upload cannot resurrect an image after a newer removal.
Image replacement/removal, revision increment and the wish's `updated_at` change
are atomic. Other wish fields are not changed by image requests.

Admin-only image endpoints are documented in
[backend-conventions.md](./backend-conventions.md#admin-wish-images).
Neither public nor client wish-list responses contain image bytes or image
metadata. The frontend upload workflow is implemented in subsequent steps.

The migration tests run against SQLite by default. To additionally verify
the migrated MariaDB integration schema, run from the repository root:

```bash
docker compose -f docker-compose.integration.yml exec -T \
  -e ORDER_ITEM_IMAGES_MYSQL_TEST=1 integration-backend \
  vendor/bin/phpunit -c phpunit.xml.dist \
  tests/Registration/OrderItemImagesMigrationTest.php
```

These tests refuse non-integration MySQL databases and roll back their fixtures.

### Migration Rules

1. Always use `change()` method (allows rollback)
2. Use UUID for primary keys
3. Include `created_at` and `updated_at` timestamps
4. Use meaningful migration names: `create_<table>_table`, `add_<column>_to_<table>`
5. Timestamp format: `YYYYMMDDHHMMSS` (e.g., `20260614080000`)

## See Also

- [backend-conventions.md](./backend-conventions.md) - PHP backend conventions
