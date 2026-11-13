import { createFeature, createReducer, on } from '@ngrx/store';
import { GiftReceiptsActions } from './gift-receipts.actions';
import { GiftReceiptsState, initialState } from './gift-receipts.state';

export const giftReceiptsFeature = createFeature({
  name: 'giftReceipts',
  reducer: createReducer<GiftReceiptsState>(
    initialState,
    on(GiftReceiptsActions.formChanged, (state, { changes }) => ({
      ...state,
      form: { ...state.form, ...changes },
      lookup: { status: 'initial' },
      receipt: { status: 'initial' },
    })),
    on(GiftReceiptsActions.searchSubmitted, (state) => ({
      ...state,
      lookup: { status: 'loading' },
      receipt: { status: 'initial' },
    })),
    on(GiftReceiptsActions.searchSucceeded, (state, { result }) => ({
      ...state,
      lookup: { status: 'loaded', result },
    })),
    on(GiftReceiptsActions.searchFailed, (state, { errorCode }) => ({
      ...state,
      lookup: { status: 'error', errorCode },
    })),
    on(GiftReceiptsActions.receiptRequested, (state) => ({
      ...state,
      receipt: { status: 'confirming' },
    })),
    on(GiftReceiptsActions.receiptConfirmed, (state) => ({
      ...state,
      receipt: { status: 'saving' },
    })),
    on(GiftReceiptsActions.receiptCancelled, (state) => ({
      ...state,
      receipt: { status: 'initial' },
    })),
    on(GiftReceiptsActions.receiptSucceeded, (state, { response }) => ({
      ...state,
      lookup: { status: 'loaded', result: response },
      receipt: { status: 'saved' },
    })),
    on(GiftReceiptsActions.receiptFailed, (state, { errorCode, result }) => ({
      ...state,
      lookup: result ? { status: 'loaded', result } : state.lookup,
      receipt: { status: 'error', errorCode },
    })),
  ),
});
