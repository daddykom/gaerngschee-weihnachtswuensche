import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { OrderService } from '../../shared/services/order.service';
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

export const orderEffects = {
  loadOrderEffect,
  orderLoadFailureNotificationEffect,
};
