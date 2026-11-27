import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  map,
  mergeMap,
  Observable,
  of,
  switchMap,
  takeUntil,
  withLatestFrom,
} from 'rxjs';
import { AdminOrdersService } from '../../shared/services/admin-orders.service';
import { OrderItemImagesService } from '../../shared/services/order-item-images.service';
import { AuthActions } from '../auth/auth.actions';
import { SessionActions } from '../auth/session.actions';
import { ImageTransfersActions } from '../image-transfers/image-transfers.actions';
import { selectImageTransfers } from '../image-transfers/image-transfers.feature';
import { QueuedImageTransfer } from '../image-transfers/image-transfers.state';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { AdminOrdersActions } from './admin-orders.actions';
import {
  selectAdminItemImage,
  selectAdminOrderCategories,
  selectAdminOrderStatuses,
} from './admin-orders.feature';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const loadAdminItemImageEffect = createEffect(
  (actions$ = inject(Actions), service = inject(OrderItemImagesService)) =>
    actions$.pipe(
      ofType(AdminOrdersActions.imageEditorEntered, AdminOrdersActions.imageReloadClicked),
      switchMap(({ orderId, itemId }) =>
        service.metadata(orderId, itemId).pipe(
          switchMap((data) => {
            const image$: Observable<Blob | null> = data.image
              ? service.image(orderId, itemId)
              : of(null);
            return image$.pipe(
              map((blob) => AdminOrdersActions.imageLoaded({ orderId, itemId, data, blob })),
            );
          }),
          catchError((error: HttpErrorResponse) =>
            of(
              AdminOrdersActions.imageLoadFailed({
                orderId,
                itemId,
                errorCode: errorCode(error),
              }),
            ),
          ),
          takeUntil(
            actions$.pipe(
              ofType(
                AuthActions.logoutRequested,
                AuthActions.logoutRequestedWithRedirect,
                SessionActions.sessionExpired,
              ),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const refreshAdminItemImageEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(ImageTransfersActions.transferSucceeded),
      withLatestFrom(store.select(selectImageTransfers), store.select(selectAdminItemImage)),
      mergeMap(([action, transfers, request]) => {
        if (!request || request.status === 'initial') return [];
        return transfers.some(
          (job) =>
            job.id === action.id &&
            job.orderId === request.orderId &&
            job.itemId === request.itemId,
        )
          ? [
              AdminOrdersActions.imageReloadClicked({
                orderId: request.orderId,
                itemId: request.itemId,
              }),
            ]
          : [];
      }),
    ),
  { functional: true },
);

export const adminItemImageErrorEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AdminOrdersActions.imageLoadFailed),
      map(({ orderId, itemId }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.itemImage.loadErrorTitle',
          messageKey: 'app.admin.itemImage.loadError',
          preserveOnRoutes: [`/admin/orders/${orderId}/edit/item/${itemId}`],
        }),
      ),
    ),
  { functional: true },
);

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
      switchMap(({ order, action, imageChanges = [] }) =>
        service.update(order, action).pipe(
          mergeMap(({ order: savedOrder, mailSent }) => {
            const transfers: QueuedImageTransfer[] = imageChanges
              .filter(({ itemId }) => savedOrder.items.some((item) => item.id === itemId))
              .map(({ itemId, change }) => ({
                id: crypto.randomUUID(),
                orderId: savedOrder.id,
                itemId,
                status: 'queued',
                change,
              }));
            return transfers.length === 0
              ? [AdminOrdersActions.saveSuccess({ order: savedOrder, mailSent })]
              : [
                  AdminOrdersActions.saveSuccess({ order: savedOrder, mailSent }),
                  ImageTransfersActions.transfersQueued({ transfers }),
                ];
          }),
          catchError((error: HttpErrorResponse) =>
            of(AdminOrdersActions.saveFailure({ errorCode: errorCode(error) })),
          ),
          takeUntil(
            actions$.pipe(
              ofType(
                AuthActions.logoutRequested,
                AuthActions.logoutRequestedWithRedirect,
                AuthActions.loginSuccess,
                AuthActions.registrationLoginSuccess,
                SessionActions.sessionExpired,
              ),
            ),
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
  loadAdminItemImageEffect,
  refreshAdminItemImageEffect,
  adminItemImageErrorEffect,
  loadAdminOrdersEffect,
  saveAdminOrderEffect,
  navigateBackAfterAdminOrderSaveEffect,
  adminOrdersNotificationEffect,
};
