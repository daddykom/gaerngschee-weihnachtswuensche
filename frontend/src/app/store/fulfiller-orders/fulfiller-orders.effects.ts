import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  debounceTime,
  EMPTY,
  exhaustMap,
  filter,
  map,
  of,
  switchMap,
  timer,
  withLatestFrom,
} from 'rxjs';
import { FulfillerOrdersService } from '../../shared/services/fulfiller-orders.service';
import { NotificationActions } from '../notification/notification.actions';
import { FulfillerOrdersActions } from './fulfiller-orders.actions';
import {
  selectFulfillerOrdersCategory,
  selectFulfillerOrdersSearch,
  selectFulfillerReservationForm,
} from './fulfiller-orders.feature';

export const FULFILLER_AVAILABILITY_EVENT = 'fulfiller-wish-availability';

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

export const requestFulfillerReservationEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), service = inject(FulfillerOrdersService)) =>
    actions$.pipe(
      ofType(FulfillerOrdersActions.reservationSubmitted),
      withLatestFrom(store.select(selectFulfillerReservationForm)),
      filter(([, form]) => form.itemId !== null),
      exhaustMap(([, form]) =>
        service.requestReservation(form.itemId as string, form.email, form.privacyAccepted).pipe(
          map(({ itemId, reservationExpiresAt }) =>
            FulfillerOrdersActions.reservationRequestSuccess({ itemId, reservationExpiresAt }),
          ),
          catchError((error: HttpErrorResponse) =>
            of(FulfillerOrdersActions.reservationRequestFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const startFulfillerAvailabilityPollingEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FulfillerOrdersService)) => {
    let lastVersion: number | null = null;

    return actions$.pipe(
      ofType(FulfillerOrdersActions.pollingStarted),
      switchMap(() =>
        timer(0, 15_000).pipe(
          exhaustMap(() => service.availabilityVersion().pipe(catchError(() => EMPTY))),
          switchMap(({ version }) => {
            const changed = lastVersion !== null && version !== lastVersion;
            lastVersion = version;

            return changed
              ? service.statuses().pipe(
                  map(({ items }) => FulfillerOrdersActions.wishStatusesUpdated({ items })),
                  catchError(() => EMPTY),
                )
              : EMPTY;
          }),
        ),
      ),
    );
  },
  { functional: true },
);

export const fulfillerOrdersNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        FulfillerOrdersActions.reservationRequestSuccess,
        FulfillerOrdersActions.reservationRequestFailure,
        FulfillerOrdersActions.loadFailure,
      ),
      map((action) => {
        if (action.type === FulfillerOrdersActions.reservationRequestSuccess.type) {
          return NotificationActions.show({
            variant: 'success',
            titleKey: 'app.fulfiller.reservationEmailSentTitle',
            messageKey: 'app.fulfiller.reservationEmailSentMessage',
            preserveOnRoutes: ['/erfuellen'],
          });
        }

        if (action.type === FulfillerOrdersActions.loadFailure.type) {
          return NotificationActions.show({
            variant: 'error',
            titleKey: 'app.fulfiller.loadErrorTitle',
            messageKey: `app.fulfiller.loadErrors.${action.errorCode}`,
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
  requestFulfillerReservationEffect,
  startFulfillerAvailabilityPollingEffect,
  fulfillerOrdersNotificationEffect,
};
