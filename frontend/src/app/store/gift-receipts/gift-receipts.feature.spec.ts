import { GiftReceiptResult } from '../../shared/models/gift-receipt.model';
import { GiftReceiptsActions } from './gift-receipts.actions';
import { giftReceiptsFeature } from './gift-receipts.feature';
import { initialState } from './gift-receipts.state';

describe('giftReceiptsFeature', () => {
  it('keeps the refreshed result available after a receipt conflict', () => {
    const result = { selectedItemId: 'one' } as GiftReceiptResult;
    const failed = giftReceiptsFeature.reducer(
      initialState,
      GiftReceiptsActions.receiptFailed({ errorCode: 'RECEIPT_CONFIRMATION_REQUIRED', result }),
    );
    expect(failed.lookup).toEqual({ status: 'loaded', result });
    expect(failed.receipt).toEqual({ status: 'error', errorCode: 'RECEIPT_CONFIRMATION_REQUIRED' });
    expect(
      giftReceiptsFeature.reducer(failed, GiftReceiptsActions.receiptCancelled()).receipt.status,
    ).toBe('initial');
  });
  it('stores form changes immutably and removes stale results', () => {
    const result = { selectedItemId: 'item-3' } as GiftReceiptResult;
    const loaded = giftReceiptsFeature.reducer(
      initialState,
      GiftReceiptsActions.searchSucceeded({ result }),
    );
    const changed = giftReceiptsFeature.reducer(
      loaded,
      GiftReceiptsActions.formChanged({ changes: { giftNumber: '12-3' } }),
    );
    expect(changed.form).toEqual({ giftNumber: '12-3' });
    expect(changed.lookup).toEqual({ status: 'initial' });
    expect(initialState.form.giftNumber).toBe('');
    expect(loaded.lookup).toEqual({ status: 'loaded', result });
  });

  it('models search loading, success and failure explicitly without changing the form', () => {
    const state = { ...initialState, form: { giftNumber: '12-3' } };
    const loading = giftReceiptsFeature.reducer(
      state,
      GiftReceiptsActions.searchSubmitted({ giftNumber: '12-3' }),
    );
    expect(loading.lookup).toEqual({ status: 'loading' });
    const result = { selectedItemId: 'item-3' } as GiftReceiptResult;
    const loaded = giftReceiptsFeature.reducer(
      loading,
      GiftReceiptsActions.searchSucceeded({ result }),
    );
    expect(loaded.lookup).toEqual({ status: 'loaded', result });
    const error = giftReceiptsFeature.reducer(
      loading,
      GiftReceiptsActions.searchFailed({ errorCode: 'GIFT_NOT_FOUND' }),
    );
    expect(error.lookup).toEqual({ status: 'error', errorCode: 'GIFT_NOT_FOUND' });
    expect(error.form).toEqual(state.form);
  });
});
