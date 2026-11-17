import { HttpErrorResponse } from '@angular/common/http';
import { Actions } from '@ngrx/effects';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AdminStatisticsService } from '../../shared/services/admin-statistics.service';
import { NotificationActions } from '../notification/notification.actions';
import { AdminStatisticsActions } from './admin-statistics.actions';
import {
  adminStatisticsErrorEffect,
  adminStatisticsRetryNotificationEffect,
  loadAdminStatisticsEffect,
} from './admin-statistics.effects';

describe('admin statistics effects', () => {
  it('loads on entry and retry', async () => {
    const statistics = {
      year: 2026,
      orderCount: 0,
      wishCount: 0,
      availableCount: 0,
      pendingConfirmationCount: 0,
      reservedCount: 0,
      receivedCount: 0,
      completedCount: 0,
    };
    const load = vi.fn(() => of(statistics));
    for (const action of [
      AdminStatisticsActions.pageEntered(),
      AdminStatisticsActions.retryClicked(),
    ]) {
      const result = await firstValueFrom(
        loadAdminStatisticsEffect(new Actions(of(action)), {
          load,
        } as unknown as AdminStatisticsService),
      );
      expect(result).toEqual(AdminStatisticsActions.statisticsLoaded({ statistics }));
    }
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('maps backend and network errors', async () => {
    for (const [error, errorCode] of [
      [{ error: { code: 'STATISTICS_LOAD_FAILED' } }, 'STATISTICS_LOAD_FAILED'],
      [null, 'REQUEST_FAILED'],
    ] as const) {
      const service = { load: () => throwError(() => new HttpErrorResponse({ error })) };
      const result = await firstValueFrom(
        loadAdminStatisticsEffect(
          new Actions(of(AdminStatisticsActions.pageEntered())),
          service as unknown as AdminStatisticsService,
        ),
      );
      expect(result).toEqual(AdminStatisticsActions.statisticsLoadFailed({ errorCode }));
    }
  });

  it('preserves the global error during initial navigation and clears it on retry', async () => {
    const notification = await firstValueFrom(
      adminStatisticsErrorEffect(
        new Actions(of(AdminStatisticsActions.statisticsLoadFailed({ errorCode: 'FAILED' }))),
      ),
    );
    expect(notification).toEqual(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.admin.statistics.errorTitle',
        messageKey: 'app.admin.statistics.loadError',
        preserveOnRoutes: ['/admin/statistics'],
      }),
    );
    expect(
      await firstValueFrom(
        adminStatisticsRetryNotificationEffect(
          new Actions(of(AdminStatisticsActions.retryClicked())),
        ),
      ),
    ).toEqual(NotificationActions.clear());
  });
});
