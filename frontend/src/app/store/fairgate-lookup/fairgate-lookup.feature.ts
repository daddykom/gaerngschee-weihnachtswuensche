import { createFeature, createReducer, on } from '@ngrx/store';
import { FairgateLookupActions } from './fairgate-lookup.actions';
import { FairgateLookupState, initialState } from './fairgate-lookup.state';

export const fairgateLookupFeature = createFeature({
  name: 'fairgateLookup',
  reducer: createReducer<FairgateLookupState>(
    initialState,
    on(FairgateLookupActions.lookup, (state) => ({
      ...state,
      loading: true,
      errorCode: null,
    })),
    on(FairgateLookupActions.lookupSuccess, (state, { result }) => ({
      ...state,
      result,
      loading: false,
      errorCode: null,
    })),
    on(FairgateLookupActions.lookupFailure, (state, { errorCode }) => ({
      ...state,
      loading: false,
      errorCode,
    })),
  ),
});

export const {
  selectResult: selectFairgateLookupResult,
  selectLoading: selectFairgateLookupLoading,
  selectErrorCode: selectFairgateLookupErrorCode,
} = fairgateLookupFeature;
