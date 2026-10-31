<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class GeneralizeEmailQueue extends AbstractMigration
{
    public function up(): void
    {
        $this->table('email_queue', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('reference_type', 'string', ['limit' => 50])
            ->addColumn('reference_id', 'string', ['limit' => 36])
            ->addColumn('email_type', 'string', ['limit' => 80])
            ->addColumn('recipient', 'string', ['limit' => 255])
            ->addColumn('subject', 'text')
            ->addColumn('html_body', 'text')
            ->addColumn('text_body', 'text')
            ->addColumn('last_error', 'text', ['null' => true, 'default' => null])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['update' => 'CURRENT_TIMESTAMP'])
            ->addIndex(['reference_type', 'reference_id', 'email_type'], ['unique' => true])
            ->addIndex('created_at')
            ->create();

        $this->execute(
            "INSERT INTO email_queue
                (id, reference_type, reference_id, email_type, recipient, subject, html_body, text_body, last_error, created_at, updated_at)
             SELECT id, 'order', order_id, email_type, recipient, subject, html_body, text_body, last_error, created_at, updated_at
             FROM order_email_queue",
        );
        $this->table('order_email_queue')->drop()->update();
    }

    public function down(): void
    {
        $this->table('order_email_queue', ['id' => false, 'primary_key' => 'id'])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('order_id', 'string', ['limit' => 36])
            ->addColumn('email_type', 'string', ['limit' => 50])
            ->addColumn('recipient', 'string', ['limit' => 255])
            ->addColumn('subject', 'text')
            ->addColumn('html_body', 'text')
            ->addColumn('text_body', 'text')
            ->addColumn('last_error', 'text', ['null' => true, 'default' => null])
            ->addColumn('created_at', 'timestamp', ['default' => 'CURRENT_TIMESTAMP'])
            ->addColumn('updated_at', 'timestamp', ['update' => 'CURRENT_TIMESTAMP'])
            ->addIndex(['order_id', 'email_type'], ['unique' => true])
            ->addIndex('created_at')
            ->addForeignKey('order_id', 'orders', 'id', ['delete' => 'CASCADE', 'update' => 'CASCADE'])
            ->create();

        $this->execute(
            "INSERT INTO order_email_queue
                (id, order_id, email_type, recipient, subject, html_body, text_body, last_error, created_at, updated_at)
             SELECT id, reference_id, email_type, recipient, subject, html_body, text_body, last_error, created_at, updated_at
             FROM email_queue WHERE reference_type = 'order'",
        );
        $this->table('email_queue')->drop()->update();
    }
}
