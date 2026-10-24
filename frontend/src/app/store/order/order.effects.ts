import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { AuthActions } from '../auth/auth.actions';
import { OrderService } from '../../shared/services/order.service';
import { OrderStatus } from '../../shared/models/order.model';
import { NotificationActions } from '../notification/notification.actions';
import { OrderActions } from './order.actions';

export const loadOrderEffect = createEffect(
  (actions$ = inject(Actions), orderService = inject(OrderService)) =>
    actions$.pipe(
      ofType(OrderActions.load),
      exhaustMap(() =>
        orderService.loadOverview().pipe(
          map((overview) => OrderActions.loadSuccess({ overview })),
          catchError((error: HttpErrorResponse) =>
            of(
              OrderActions.loadFailure({
                errorCode:
                  typeof error.error?.error?.code === 'string'
                    ? error.error.error.code
                    : 'ORDER_LOAD_FAILED',
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const saveOrderEffect = createEffect(
  (actions$ = inject(Actions), orderService = inject(OrderService)) =>
    actions$.pipe(
      ofType(OrderActions.save),
      exhaustMap(({ form }) =>
        orderService.save(form).pipe(
          map((result) => OrderActions.saveSuccess({ result })),
          catchError((error: HttpErrorResponse) =>
            of(
              OrderActions.saveFailure({
                errorCode:
                  typeof error.error?.error?.code === 'string'
                    ? error.error.error.code
                    : 'ORDER_SAVE_FAILED',
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const logoutAfterOrderSaveEffect = createEffect(
  (actions$ = inject(Actions)) => actions$.pipe(
    ofType(OrderActions.saveSuccess),
    map(({ result }) => AuthActions.logoutRequestedWithRedirect({
      target: `/bestellung/bestaetigung?status=${result.status}`,
    })),
  ),
  { functional: true },
);

export const orderFairgateNotificationEffect = createEffect(
  (actions$ = inject(Actions)) => actions$.pipe(
    ofType(OrderActions.loadSuccess),
    map(({ overview }) => {
      const status = overview.order?.status;
      const canEdit = status === undefined || ['draft', 'family_size_exceeded', 'changes_requested'].includes(status as OrderStatus);
      if (status !== undefined && !canEdit) {
        return NotificationActions.show({
          variant: 'info',
          titleKey: `app.order.status.${status}.title`,
          messageKey: `app.order.status.${status}.message`,
          preserveOnRoutes: ['/bestellung'],
        });
      }

      return overview.fairgateUserExists
        ? NotificationActions.show({
        variant: 'info',
        titleKey: 'app.order.fairgate.validTitle',
        messageKey: 'app.order.fairgate.validMessage',
        preserveOnRoutes: ['/bestellung'],
      })
      : NotificationActions.show({
        variant: 'warning',
        titleKey: 'app.order.fairgate.manualTitle',
        messageKey: 'app.order.fairgate.manualMessage',
        preserveOnRoutes: ['/bestellung'],
      });
    }),
  ),
  { functional: true },
);

export const orderSaveSuccessNotificationEffect = createEffect(
  (actions$ = inject(Actions)) => actions$.pipe(
    ofType(OrderActions.saveSuccess),
    map(({ result }) => result.status === 'released'
      ? NotificationActions.show({
        variant: 'success',
        titleKey: 'app.order.confirmation.releasedTitle',
        messageKey: 'app.order.confirmation.releasedMessage',
        preserveOnRoutes: ['/bestellung/bestaetigung'],
      })
      : NotificationActions.show({
        variant: 'warning',
        titleKey: 'app.order.confirmation.waitingForFairgateTitle',
        messageKey: 'app.order.confirmation.waitingForFairgateMessage',
        preserveOnRoutes: ['/bestellung/bestaetigung'],
      })),
  ),
  { functional: true },
);

export const orderLoadFailureNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(OrderActions.loadFailure),
      map(() =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.order.notifications.loadErrorTitle',
          messageKey: 'app.order.notifications.loadError',
          preserveOnRoutes: ['/bestellung'],
        }),
      ),
    ),
  { functional: true },
);

export const orderSaveFailureNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(OrderActions.saveFailure),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.order.notifications.saveErrorTitle',
          messageKey: `app.order.notifications.errors.${errorCode}`,
          preserveOnRoutes: ['/bestellung'],
        }),
      ),
    ),
  { functional: true },
);

export const orderEffects = {
  loadOrderEffect,
  saveOrderEffect,
  logoutAfterOrderSaveEffect,
  orderFairgateNotificationEffect,
  orderSaveSuccessNotificationEffect,
  orderLoadFailureNotificationEffect,
  orderSaveFailureNotificationEffect,
};
