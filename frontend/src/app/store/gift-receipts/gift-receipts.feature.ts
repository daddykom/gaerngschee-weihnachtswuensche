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
    })),
    on(GiftReceiptsActions.searchSubmitted, (state) => ({
      ...state,
      lookup: { status: 'loading' },
    })),
    on(GiftReceiptsActions.searchSucceeded, (state, { result }) => ({
      ...state,
      lookup: { status: 'loaded', result },
    })),
    on(GiftReceiptsActions.searchFailed, (state, { errorCode }) => ({
      ...state,
      lookup: { status: 'error', errorCode },
    })),
  ),
});
