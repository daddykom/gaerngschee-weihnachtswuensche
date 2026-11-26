import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  concat,
  concatMap,
  defer,
  EMPTY,
  map,
  mergeMap,
  of,
  switchMap,
  take,
  takeUntil,
} from 'rxjs';
import { OrderItemImagesService } from '../../shared/services/order-item-images.service';
import { AuthActions } from '../auth/auth.actions';
import { SessionActions } from '../auth/session.actions';
import { ImageTransfersActions } from './image-transfers.actions';
import { selectImageTransfers } from './image-transfers.feature';

export const transferImageEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), service = inject(OrderItemImagesService)) =>
    actions$.pipe(
      ofType(ImageTransfersActions.transfersQueued, ImageTransfersActions.retryClicked),
      mergeMap((action) =>
        'transfers' in action ? action.transfers.map((transfer) => transfer.id) : [action.id],
      ),
      // Keep requests independent of route lifetimes and serialize image writes.
      concatMap((id) =>
        store.select(selectImageTransfers).pipe(
          take(1),
          switchMap((transfers) => {
            const transfer = transfers.find((candidate) => candidate.id === id);
            if (transfer?.status !== 'queued') return EMPTY;
            const { orderId, itemId, change } = transfer;
            const request$ = defer(() =>
              change.operation === 'remove'
                ? service
                    .remove(orderId, itemId, change.revision)
                    .pipe(map((result) => ImageTransfersActions.transferSucceeded({ id, result })))
                : service.upload(orderId, itemId, change.revision, change.file).pipe(
                    mergeMap((event) => {
                      if (
                        event.type === HttpEventType.UploadProgress &&
                        event.total !== undefined &&
                        event.total > 0
                      ) {
                        return of(
                          ImageTransfersActions.transferProgressed({
                            id,
                            percent: (100 * event.loaded) / event.total,
                          }),
                        );
                      }
                      if (event.type === HttpEventType.Response) {
                        return of(
                          event.body === null
                            ? ImageTransfersActions.transferFailed({
                                id,
                                errorCode: 'INVALID_IMAGE_RESPONSE',
                              })
                            : ImageTransfersActions.transferSucceeded({ id, result: event.body }),
                        );
                      }
                      return EMPTY;
                    }),
                  ),
            ).pipe(
              catchError((error: HttpErrorResponse) =>
                of(
                  ImageTransfersActions.transferFailed({
                    id,
                    errorCode:
                      typeof error.error?.error?.code === 'string'
                        ? error.error.error.code
                        : 'REQUEST_FAILED',
                  }),
                ),
              ),
            );
            return concat(of(ImageTransfersActions.transferStarted({ id })), request$);
          }),
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

export const imageTransfersEffects = { transferImageEffect };
