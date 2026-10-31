import { FairgateTestActions } from './fairgate-test.actions';
import {
  fairgateTestFeature,
  selectFairgateTestErrorCode,
  selectFairgateTestLoading,
  selectFairgateTestResult,
} from './fairgate-test.feature';
import { initialState } from './fairgate-test.state';

describe('fairgateTestFeature', () => {
  it('has the expected initial state and selectors', () => {
    expect(fairgateTestFeature.reducer(undefined, { type: '@@init' })).toEqual(initialState);
    const result = { email: 'person@example.com', fairgate: {} };
    const state = { fairgateTest: { result, status: 'loading' as const, errorCode: 'FAILED' } };
    expect(selectFairgateTestResult(state)).toEqual(result);
    expect(selectFairgateTestLoading(state)).toBe(true);
    expect(selectFairgateTestErrorCode(state)).toBe('FAILED');
  });

  it('clears errors while testing and stores success or failure', () => {
    const result = { email: 'person@example.com', fairgate: {} };
    const testing = fairgateTestFeature.reducer(
      { ...initialState, errorCode: 'OLD' },
      FairgateTestActions.test(),
    );
    const success = fairgateTestFeature.reducer(
      testing,
      FairgateTestActions.testSuccess({ result }),
    );
    const failure = fairgateTestFeature.reducer(
      testing,
      FairgateTestActions.testFailure({ errorCode: 'FAILED' }),
    );
    expect(testing).toEqual({ result: null, status: 'loading', errorCode: null });
    expect(success).toEqual({ result, status: 'loaded', errorCode: null });
    expect(failure).toEqual({ result: null, status: 'error', errorCode: 'FAILED' });
  });
});
