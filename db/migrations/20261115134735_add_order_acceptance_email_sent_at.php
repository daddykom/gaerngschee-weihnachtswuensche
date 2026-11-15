<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddOrderAcceptanceEmailSentAt extends AbstractMigration
{
    public function change(): void
    {
        $this->table('orders')
            ->addColumn('acceptance_email_sent_at', 'timestamp', ['null' => true, 'default' => null])
            ->update();
    }
}
