import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { AdminOrdersService } from '../../shared/services/admin-orders.service';
import { NotificationActions } from '../notification/notification.actions';
import { AdminOrdersActions } from './admin-orders.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const loadAdminOrdersEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminOrdersService)) => actions$.pipe(
    ofType(AdminOrdersActions.load),
    switchMap(({ statuses, categories }) => service.list(statuses, categories).pipe(
      map(({ orders = [] }) => AdminOrdersActions.loadSuccess({ orders })),
      catchError((error: HttpErrorResponse) => of(AdminOrdersActions.loadFailure({ errorCode: errorCode(error) }))),
    )),
  ), { functional: true },
);

export const saveAdminOrderEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminOrdersService)) => actions$.pipe(
    ofType(AdminOrdersActions.save),
    switchMap(({ order }) => service.update(order).pipe(
      map(({ order: savedOrder }) => AdminOrdersActions.saveSuccess({ order: savedOrder })),
      catchError((error: HttpErrorResponse) => of(AdminOrdersActions.saveFailure({ errorCode: errorCode(error) }))),
    )),
  ), { functional: true },
);

export const adminOrdersNotificationEffect = createEffect(
  (actions$ = inject(Actions)) => actions$.pipe(
    ofType(AdminOrdersActions.saveSuccess, AdminOrdersActions.saveFailure, AdminOrdersActions.loadFailure),
    map((action) => action.type === AdminOrdersActions.saveSuccess.type
      ? NotificationActions.show({ variant: 'success', titleKey: 'app.admin.overview.successTitle', messageKey: 'app.admin.overview.saved', preserveOnRoutes: ['/admin/overview'] })
      : NotificationActions.show({ variant: 'error', titleKey: 'app.admin.overview.errorTitle', messageKey: `app.admin.overview.errors.${action.errorCode}`, preserveOnRoutes: ['/admin/overview'] })),
  ), { functional: true },
);

export const adminOrdersEffects = { loadAdminOrdersEffect, saveAdminOrderEffect, adminOrdersNotificationEffect };
