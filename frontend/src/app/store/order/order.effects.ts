import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
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

export const navigateAfterOrderSaveEffect = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(OrderActions.saveSuccess),
      map(({ result }) =>
        router.createUrlTree(['/bestellung/bestaetigung'], {
          queryParams: { status: result.status },
        }),
      ),
      tap((urlTree) => void router.navigateByUrl(urlTree)),
    ),
  { functional: true, dispatch: false },
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
  navigateAfterOrderSaveEffect,
  orderLoadFailureNotificationEffect,
  orderSaveFailureNotificationEffect,
};
