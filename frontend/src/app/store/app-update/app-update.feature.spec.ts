import { BUILD_INFO } from '../../../generated/build-info';
import { AppUpdateActions, appUpdateFeature, initialState } from './app-update.feature';

describe('appUpdateFeature', () => {
  const reducer = appUpdateFeature.reducer;

  it('starts without a pending update, deferral or reload', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('records a different build without changing the previous state', () => {
    expect(reducer(initialState, AppUpdateActions.buildDetected({ buildId: 'new-build' }))).toEqual(
      {
        ...initialState,
        pendingBuildId: 'new-build',
      },
    );
    expect(initialState.pendingBuildId).toBeNull();
  });

  it('does not treat the running build as an update', () => {
    const state = { ...initialState, pendingBuildId: 'new-build' };
    expect(reducer(state, AppUpdateActions.buildDetected({ buildId: BUILD_INFO.buildId }))).toEqual(
      {
        ...state,
        pendingBuildId: null,
      },
    );
  });

  it('restores and records deferrals without hiding the pending notice', () => {
    const state = { ...initialState, pendingBuildId: 'new-build' };
    const expected = { ...state, deferredBuildId: 'new-build' };
    expect(reducer(state, AppUpdateActions.deferralRestored({ buildId: 'new-build' }))).toEqual(
      expected,
    );
    expect(reducer(state, AppUpdateActions.reloadDeferred({ buildId: 'new-build' }))).toEqual(
      expected,
    );
    expect(reducer(expected, AppUpdateActions.deferralRestored({ buildId: null }))).toEqual(state);
  });

  it('marks a confirmed reload so subsequent update events cannot reopen the dialog', () => {
    const state = { ...initialState, pendingBuildId: 'new-build' };
    const reloading = reducer(state, AppUpdateActions.reloadConfirmed({ buildId: 'new-build' }));
    expect(reloading).toEqual({ ...state, reloading: true });
    expect(
      reducer(reloading, AppUpdateActions.buildDetected({ buildId: 'newer-build' })).reloading,
    ).toBe(true);
  });
});
