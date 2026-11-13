import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  exhaustMap,
  filter,
  map,
  of,
  switchMap,
  take,
  takeUntil,
  withLatestFrom,
} from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog';
import { GiftReceiptService } from '../../shared/services/gift-receipt.service';
import { receiptConfirmation } from '../../shared/utils/gift-receipt';
import { NotificationActions } from '../notification/notification.actions';
import { GiftReceiptsActions } from './gift-receipts.actions';
import { giftReceiptsFeature } from './gift-receipts.feature';

export const searchGiftsEffect = createEffect(
  (actions$ = inject(Actions), service = inject(GiftReceiptService)) =>
    actions$.pipe(
      ofType(GiftReceiptsActions.searchSubmitted),
      switchMap(({ giftNumber }) =>
        service.lookup(giftNumber).pipe(
          map((result) => GiftReceiptsActions.searchSucceeded({ result })),
          catchError((error: HttpErrorResponse) =>
            of(
              GiftReceiptsActions.searchFailed({
                errorCode:
                  typeof error.error?.error?.code === 'string'
                    ? error.error.error.code
                    : 'REQUEST_FAILED',
              }),
            ),
          ),
          takeUntil(actions$.pipe(ofType(GiftReceiptsActions.formChanged))),
        ),
      ),
    ),
  { functional: true },
);

export const clearGiftSearchNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(GiftReceiptsActions.searchSubmitted),
      map(() => NotificationActions.clear()),
    ),
  { functional: true },
);

export const showGiftSearchErrorEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(GiftReceiptsActions.searchFailed),
      filter(({ errorCode }) => errorCode !== 'SESSION_EXPIRED'),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: errorCode === 'GIFT_NOT_FOUND' ? 'warning' : 'error',
          titleKey: 'app.giftReceipts.errorTitle',
          messageKey: `app.giftReceipts.errors.${['GIFT_NOT_FOUND', 'INVALID_GIFT_NUMBER'].includes(errorCode) ? errorCode : 'REQUEST_FAILED'}`,
          preserveOnRoutes: ['/user/gift-receipts'],
        }),
      ),
    ),
  { functional: true },
);

export const confirmGiftReceiptEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), dialog = inject(MatDialog)) =>
    actions$.pipe(
      ofType(GiftReceiptsActions.receiptRequested),
      withLatestFrom(store.select(giftReceiptsFeature.selectLookup)),
      exhaustMap(([, lookup]) => {
        const confirmation = lookup.status === 'loaded' ? receiptConfirmation(lookup.result) : null;
        if (!confirmation) return of(GiftReceiptsActions.receiptCancelled());
        if (!confirmation.confirmUnreserved && !confirmation.confirmPickup)
          return of(GiftReceiptsActions.receiptConfirmed(confirmation));
        return dialog
          .open(ConfirmDialogComponent, {
            autoFocus: 'first-tabbable',
            data: {
              title: confirmation.confirmPickup
                ? 'app.giftReceipts.confirmPickupTitle'
                : 'app.giftReceipts.confirmUnreservedTitle',
              message: confirmation.confirmPickup
                ? confirmation.confirmUnreserved
                  ? 'app.giftReceipts.confirmBoth'
                  : 'app.giftReceipts.confirmPickup'
                : 'app.giftReceipts.confirmUnreserved',
              confirmLabel: confirmation.confirmPickup
                ? 'app.giftReceipts.receiveAndRelease'
                : 'app.giftReceipts.receiveAnyway',
              cancelLabel: 'app.giftReceipts.cancel',
            },
          })
          .afterClosed()
          .pipe(
            take(1),
            map((confirmed) =>
              confirmed === true
                ? GiftReceiptsActions.receiptConfirmed(confirmation)
                : GiftReceiptsActions.receiptCancelled(),
            ),
          );
      }),
    ),
  { functional: true },
);

export const receiveGiftEffect = createEffect(
  (actions$ = inject(Actions), service = inject(GiftReceiptService)) =>
    actions$.pipe(
      ofType(GiftReceiptsActions.receiptConfirmed),
      exhaustMap(({ giftNumber, confirmUnreserved, confirmPickup }) =>
        service.receive(giftNumber, confirmUnreserved, confirmPickup).pipe(
          map((response) => GiftReceiptsActions.receiptSucceeded({ response })),
          catchError((error: HttpErrorResponse) =>
            of(
              GiftReceiptsActions.receiptFailed({
                errorCode:
                  typeof error.error?.error?.code === 'string'
                    ? error.error.error.code
                    : 'RECEIPT_FAILED',
                result:
                  error.error?.error?.code === 'RECEIPT_CONFIRMATION_REQUIRED'
                    ? error.error.error.details?.result
                    : undefined,
              }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const receiptNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(GiftReceiptsActions.receiptSucceeded, GiftReceiptsActions.receiptFailed),
      filter((action) => !('errorCode' in action) || action.errorCode !== 'SESSION_EXPIRED'),
      map((action) => {
        if ('response' in action) {
          const response = action.response;
          return NotificationActions.show({
            variant: response.mailStatus === 'pending' ? 'warning' : 'success',
            titleKey: 'app.giftReceipts.receiptTitle',
            messageKey: `app.giftReceipts.${response.mailStatus === 'pending' ? 'mailPending' : response.alreadyReceived ? 'alreadyReceived' : response.mailStatus === 'sent' ? 'released' : 'received'}`,
          });
        }
        const code = [
          'RECEIPT_CONFIRMATION_REQUIRED',
          'GIFT_NOT_RECEIVABLE',
          'GIFT_NOT_FOUND',
        ].includes(action.errorCode)
          ? action.errorCode
          : 'RECEIPT_FAILED';
        return NotificationActions.show({
          variant: 'warning',
          titleKey: 'app.giftReceipts.receiptTitle',
          messageKey: `app.giftReceipts.errors.${code}`,
        });
      }),
    ),
  { functional: true },
);

export const giftReceiptsEffects = {
  confirmGiftReceiptEffect,
  receiveGiftEffect,
  receiptNotificationEffect,
  searchGiftsEffect,
  clearGiftSearchNotificationEffect,
  showGiftSearchErrorEffect,
};
