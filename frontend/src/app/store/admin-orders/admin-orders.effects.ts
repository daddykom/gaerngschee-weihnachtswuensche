import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, switchMap, withLatestFrom } from 'rxjs';
import { AdminOrdersService } from '../../shared/services/admin-orders.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { AdminOrdersActions } from './admin-orders.actions';
import { selectAdminOrderCategories, selectAdminOrderStatuses } from './admin-orders.feature';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const loadAdminOrdersEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), service = inject(AdminOrdersService)) =>
    actions$.pipe(
      ofType(AdminOrdersActions.load, AdminOrdersActions.filtersChanged),
      withLatestFrom(
        store.select(selectAdminOrderStatuses),
        store.select(selectAdminOrderCategories),
      ),
      switchMap(([, statuses, categories]) =>
        service.list(statuses, categories).pipe(
          map(({ orders = [] }) => AdminOrdersActions.loadSuccess({ orders })),
          catchError((error: HttpErrorResponse) =>
            of(AdminOrdersActions.loadFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const saveAdminOrderEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminOrdersService)) =>
    actions$.pipe(
      ofType(AdminOrdersActions.save),
      switchMap(({ order, action }) =>
        service.update(order, action).pipe(
          map(({ order: savedOrder, mailSent }) =>
            AdminOrdersActions.saveSuccess({ order: savedOrder, mailSent }),
          ),
          catchError((error: HttpErrorResponse) =>
            of(AdminOrdersActions.saveFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const navigateBackAfterAdminOrderSaveEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AdminOrdersActions.saveSuccess),
      map(() => NavigationActions.navigate({ target: 'back' })),
    ),
  { functional: true },
);

export const adminOrdersNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        AdminOrdersActions.saveSuccess,
        AdminOrdersActions.saveFailure,
        AdminOrdersActions.loadFailure,
      ),
      map((action) =>
        action.type === AdminOrdersActions.saveSuccess.type
          ? NotificationActions.show({
              variant: 'success',
              titleKey: action.mailSent
                ? 'app.admin.overview.emailSentTitle'
                : 'app.admin.overview.successTitle',
              messageKey: action.mailSent
                ? 'app.admin.overview.emailSent'
                : 'app.admin.overview.saved',
              preserveOnRoutes: ['/admin/overview', '/admin/orders'],
            })
          : NotificationActions.show({
              variant: 'error',
              titleKey:
                action.type === AdminOrdersActions.saveFailure.type
                  ? 'app.admin.overview.saveErrorTitle'
                  : 'app.admin.overview.errorTitle',
              messageKey: `app.admin.overview.errors.${action.errorCode}`,
              preserveOnRoutes: ['/admin/overview', '/admin/orders'],
            }),
      ),
    ),
  { functional: true },
);

export const adminOrdersEffects = {
  releaseAdminFulfillerEffect: createEffect(
    (actions$ = inject(Actions), service = inject(AdminOrdersService)) =>
      actions$.pipe(
        ofType(AdminOrdersActions.fulfillerRemovalConfirmed),
        exhaustMap(({ orderId, itemId, assignment }) =>
          service.releaseFulfiller(orderId, itemId, assignment).pipe(
            map(({ item }) => AdminOrdersActions.fulfillerRemoved({ orderId, item })),
            catchError((error: HttpErrorResponse) =>
              of(
                AdminOrdersActions.fulfillerRemovalFailed({ itemId, errorCode: errorCode(error) }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),
  fulfillerRemovalNotificationEffect: createEffect(
    (actions$ = inject(Actions)) =>
      actions$.pipe(
        ofType(AdminOrdersActions.fulfillerRemoved, AdminOrdersActions.fulfillerRemovalFailed),
        map((action) =>
          NotificationActions.show({
            variant: action.type === AdminOrdersActions.fulfillerRemoved.type ? 'success' : 'error',
            titleKey: 'app.admin.fulfillerRemoval.title',
            messageKey:
              action.type === AdminOrdersActions.fulfillerRemoved.type
                ? 'app.admin.fulfillerRemoval.success'
                : `app.admin.fulfillerRemoval.errors.${action.errorCode}`,
            preserveOnRoutes: ['/admin/overview', '/admin/orders'],
          }),
        ),
      ),
    { functional: true },
  ),
  loadAdminOrdersEffect,
  saveAdminOrderEffect,
  navigateBackAfterAdminOrderSaveEffect,
  adminOrdersNotificationEffect,
};
