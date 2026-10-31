import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, filter, map, of, switchMap, withLatestFrom } from 'rxjs';
import { FulfillerOrdersService } from '../../shared/services/fulfiller-orders.service';
import { NotificationActions } from '../notification/notification.actions';
import { FulfillerOrdersActions } from './fulfiller-orders.actions';
import {
  selectFulfillerOrdersCategory,
  selectFulfillerOrdersSearch,
} from './fulfiller-orders.feature';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

const loadOrders = (
  service: FulfillerOrdersService,
  search: string,
  category: 'gift' | 'voucher' | '',
) =>
  service.list(search, category).pipe(
    map(({ orders = [] }) => FulfillerOrdersActions.loadSuccess({ orders })),
    catchError((error: HttpErrorResponse) =>
      of(FulfillerOrdersActions.loadFailure({ errorCode: errorCode(error) })),
    ),
  );

export const loadFulfillerOrdersEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), service = inject(FulfillerOrdersService)) =>
    actions$.pipe(
      ofType(FulfillerOrdersActions.load),
      withLatestFrom(
        store.select(selectFulfillerOrdersSearch),
        store.select(selectFulfillerOrdersCategory),
      ),
      switchMap(([, search, category]) => loadOrders(service, search, category)),
    ),
  { functional: true },
);

export const filterFulfillerOrdersEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), service = inject(FulfillerOrdersService)) =>
    actions$.pipe(
      ofType(FulfillerOrdersActions.searchChanged, FulfillerOrdersActions.categoryChanged),
      debounceTime(350),
      withLatestFrom(
        store.select(selectFulfillerOrdersSearch),
        store.select(selectFulfillerOrdersCategory),
      ),
      filter(
        ([action, search]) =>
          action.type === FulfillerOrdersActions.categoryChanged.type ||
          search.trim() === '' ||
          search.trim().length >= 3,
      ),
      switchMap(([, search, category]) => loadOrders(service, search, category)),
    ),
  { functional: true },
);

export const reserveFulfillerWishEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FulfillerOrdersService)) =>
    actions$.pipe(
      ofType(FulfillerOrdersActions.reserve),
      switchMap(({ itemId }) =>
        service.reserve(itemId).pipe(
          map(({ item }) =>
            FulfillerOrdersActions.reserveSuccess({
              orderId: item.orderId,
              itemId: item.id,
              reservedAt: item.reservedAt,
            }),
          ),
          catchError((error: HttpErrorResponse) =>
            of(FulfillerOrdersActions.reserveFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const fulfillerOrdersNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        FulfillerOrdersActions.reserveSuccess,
        FulfillerOrdersActions.reserveFailure,
        FulfillerOrdersActions.loadFailure,
      ),
      map((action) => {
        if (action.type === FulfillerOrdersActions.reserveSuccess.type) {
          return NotificationActions.show({
            variant: 'success',
            titleKey: 'app.fulfiller.successTitle',
            messageKey: 'app.fulfiller.reservedMessage',
            preserveOnRoutes: ['/erfuellen'],
          });
        }

        return NotificationActions.show({
          variant: 'error',
          titleKey: 'app.fulfiller.errorTitle',
          messageKey: `app.fulfiller.errors.${action.errorCode}`,
          preserveOnRoutes: ['/erfuellen'],
        });
      }),
    ),
  { functional: true },
);

export const fulfillerOrdersEffects = {
  loadFulfillerOrdersEffect,
  filterFulfillerOrdersEffect,
  reserveFulfillerWishEffect,
  fulfillerOrdersNotificationEffect,
};
