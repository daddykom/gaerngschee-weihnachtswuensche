<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;
use Phinx\Migration\IrreversibleMigrationException;

final class AllowFreeTextFulfillerHandoverDate extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->isMigratingUp()) {
            // Restoring the date pattern could invalidate an already configured date range.
            throw new IrreversibleMigrationException('The handover date must remain a free-text value.');
        }

        $this->getQueryBuilder('update')
            ->update('frontend_config')
            ->set([
                'pattern' => null,
                'description' => 'Abgabetermin oder Abgabezeitraum für erfüllte Weihnachtswünsche als Freitext.',
                'placeholder' => 'z. B. 17.–19. Dezember 2026',
            ])
            ->where(['variable_name' => 'fulfiller_handover_date'])
            ->execute();
    }
}
