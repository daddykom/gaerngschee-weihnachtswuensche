import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { GiftReceiptResult } from '../../shared/models/gift-receipt.model';
import { GiftReceiptService } from '../../shared/services/gift-receipt.service';
import { NotificationActions } from '../notification/notification.actions';
import { GiftReceiptsActions } from './gift-receipts.actions';
import {
  clearGiftSearchNotificationEffect,
  searchGiftsEffect,
  showGiftSearchErrorEffect,
} from './gift-receipts.effects';

describe('gift receipt effects', () => {
  let actions$: Subject<Action>;
  const service = { lookup: vi.fn() };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    service.lookup.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        { provide: GiftReceiptService, useValue: service },
      ],
    });
  });

  afterEach(() => actions$.complete());

  it('maps a successful lookup', async () => {
    const result = { selectedItemId: 'item-3' } as GiftReceiptResult;
    service.lookup.mockReturnValue(of(result));
    const output = firstValueFrom(TestBed.runInInjectionContext(() => searchGiftsEffect()));
    actions$.next(GiftReceiptsActions.searchSubmitted({ giftNumber: '12-3' }));
    await expect(output).resolves.toEqual(GiftReceiptsActions.searchSucceeded({ result }));
    expect(service.lookup).toHaveBeenCalledWith('12-3');
  });

  it('maps network failures to a translated fallback', async () => {
    service.lookup.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const output = firstValueFrom(TestBed.runInInjectionContext(() => searchGiftsEffect()));
    actions$.next(GiftReceiptsActions.searchSubmitted({ giftNumber: '12-3' }));
    await expect(output).resolves.toEqual(
      GiftReceiptsActions.searchFailed({ errorCode: 'REQUEST_FAILED' }),
    );
  });

  it('cancels stale requests on edits and accepts a subsequent search', () => {
    const pending = new Subject<GiftReceiptResult>();
    const result = { selectedItemId: 'item-4' } as GiftReceiptResult;
    service.lookup.mockReturnValueOnce(pending).mockReturnValueOnce(of(result));
    const output = vi.fn();
    const subscription = TestBed.runInInjectionContext(() => searchGiftsEffect()).subscribe(output);
    actions$.next(GiftReceiptsActions.searchSubmitted({ giftNumber: '12-3' }));
    expect(pending.observed).toBe(true);
    actions$.next(GiftReceiptsActions.formChanged({ changes: { giftNumber: '12-4' } }));
    expect(pending.observed).toBe(false);
    pending.next({ selectedItemId: 'item-3' } as GiftReceiptResult);
    expect(output).not.toHaveBeenCalled();
    actions$.next(GiftReceiptsActions.searchSubmitted({ giftNumber: '12-4' }));
    expect(output).toHaveBeenCalledWith(GiftReceiptsActions.searchSucceeded({ result }));
    subscription.unsubscribe();
  });

  it.each(['GIFT_NOT_FOUND', 'INVALID_GIFT_NUMBER', 'UNEXPECTED'])(
    'shows the translated %s error centrally',
    async (errorCode) => {
      const output = firstValueFrom(
        TestBed.runInInjectionContext(() => showGiftSearchErrorEffect()),
      );
      actions$.next(GiftReceiptsActions.searchFailed({ errorCode }));
      await expect(output).resolves.toMatchObject({
        variant: errorCode === 'GIFT_NOT_FOUND' ? 'warning' : 'error',
        messageKey: `app.giftReceipts.errors.${errorCode === 'UNEXPECTED' ? 'REQUEST_FAILED' : errorCode}`,
      });
    },
  );

  it('does not overwrite session-expired notifications', () => {
    const output = vi.fn();
    const subscription = TestBed.runInInjectionContext(() => showGiftSearchErrorEffect()).subscribe(
      output,
    );
    actions$.next(GiftReceiptsActions.searchFailed({ errorCode: 'SESSION_EXPIRED' }));
    expect(output).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('clears an old error on the next search', async () => {
    const output = firstValueFrom(
      TestBed.runInInjectionContext(() => clearGiftSearchNotificationEffect()),
    );
    actions$.next(GiftReceiptsActions.searchSubmitted({ giftNumber: '12-3' }));
    await expect(output).resolves.toEqual(NotificationActions.clear());
  });
});
