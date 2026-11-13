import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, filter, map, of, switchMap, takeUntil } from 'rxjs';
import { GiftReceiptService } from '../../shared/services/gift-receipt.service';
import { NotificationActions } from '../notification/notification.actions';
import { GiftReceiptsActions } from './gift-receipts.actions';

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

export const giftReceiptsEffects = {
  searchGiftsEffect,
  clearGiftSearchNotificationEffect,
  showGiftSearchErrorEffect,
};
