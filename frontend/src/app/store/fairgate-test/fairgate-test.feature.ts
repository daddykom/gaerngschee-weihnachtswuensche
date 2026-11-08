import { createFeature, createReducer, on } from '@ngrx/store';
import { FairgateTestActions } from './fairgate-test.actions';
import { FairgateTestState, initialState } from './fairgate-test.state';

export const fairgateTestFeature = createFeature({
  name: 'fairgateTest',
  reducer: createReducer<FairgateTestState>(
    initialState,
    on(FairgateTestActions.test, (state) => ({
      ...state,
      status: 'loading',
      errorCode: null,
    })),
    on(FairgateTestActions.testSuccess, (state, { result }) => ({
      ...state,
      result,
      status: 'loaded',
      errorCode: null,
    })),
    on(FairgateTestActions.testFailure, (state, { errorCode }) => ({
      ...state,
      status: 'error',
      errorCode,
    })),
  ),
});

export const {
  name: fairgateTestFeatureName,
  reducer: fairgateTestReducer,
  selectResult: selectFairgateTestResult,
  selectStatus: selectFairgateTestStatus,
  selectErrorCode: selectFairgateTestErrorCode,
} = fairgateTestFeature;

export const selectFairgateTestLoading = (state: { fairgateTest: FairgateTestState }): boolean =>
  state.fairgateTest.status === 'loading';
