<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class ReconcileOrderItemFields extends AbstractMigration
{
    public function up(): void
    {
        $this->execute(
            "UPDATE order_items
             SET current_description = current_title
             WHERE (current_description IS NULL OR TRIM(current_description) = '')
               AND current_title IS NOT NULL
               AND TRIM(current_title) <> ''",
        );

        $this->execute(
            "UPDATE order_items
             SET publication_status = status
             WHERE publication_status = 'draft'
               AND status IN ('submitted', 'rejected', 'approved')",
        );
    }

    public function down(): void
    {
    }
}
