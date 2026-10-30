import { createFeature, createReducer, on } from '@ngrx/store';
import { FairgateLookupActions } from './fairgate-lookup.actions';
import { FairgateLookupState, initialState } from './fairgate-lookup.state';

export const fairgateLookupFeature = createFeature({
  name: 'fairgateLookup',
  reducer: createReducer<FairgateLookupState>(
    initialState,
    on(FairgateLookupActions.lookup, (state) => ({
      ...state,
      status: 'loading',
      errorCode: null,
    })),
    on(FairgateLookupActions.lookupSuccess, (state, { result }) => ({
      ...state,
      result,
      status: 'loaded',
      errorCode: null,
    })),
    on(FairgateLookupActions.lookupFailure, (state, { errorCode }) => ({
      ...state,
      status: 'error',
      errorCode,
    })),
  ),
});

export const {
  selectResult: selectFairgateLookupResult,
  selectStatus: selectFairgateLookupStatus,
  selectErrorCode: selectFairgateLookupErrorCode,
} = fairgateLookupFeature;

export const selectFairgateLookupLoading = (state: { fairgateLookup: FairgateLookupState }): boolean =>
  state.fairgateLookup.status === 'loading';
