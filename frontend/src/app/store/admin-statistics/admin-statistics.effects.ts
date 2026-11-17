import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { AdminStatisticsService } from '../../shared/services/admin-statistics.service';
import { NotificationActions } from '../notification/notification.actions';
import { AdminStatisticsActions } from './admin-statistics.actions';

export const loadAdminStatisticsEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminStatisticsService)) =>
    actions$.pipe(
      ofType(AdminStatisticsActions.pageEntered, AdminStatisticsActions.retryClicked),
      switchMap(() =>
        service.load().pipe(
          map((statistics) => AdminStatisticsActions.statisticsLoaded({ statistics })),
          catchError((error: HttpErrorResponse) =>
            of(
              AdminStatisticsActions.statisticsLoadFailed({
                errorCode:
                  typeof error.error?.error?.code === 'string'
                    ? error.error.error.code
                    : 'REQUEST_FAILED',
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const adminStatisticsErrorEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AdminStatisticsActions.statisticsLoadFailed),
      map(() =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.statistics.errorTitle',
          messageKey: 'app.admin.statistics.loadError',
          preserveOnRoutes: ['/admin/statistics'],
        }),
      ),
    ),
  { functional: true },
);

export const adminStatisticsRetryNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AdminStatisticsActions.retryClicked),
      map(() => NotificationActions.clear()),
    ),
  { functional: true },
);

export const adminStatisticsEffects = {
  loadAdminStatisticsEffect,
  adminStatisticsErrorEffect,
  adminStatisticsRetryNotificationEffect,
};
