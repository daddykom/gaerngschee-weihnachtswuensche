import { FrontendConfigActions } from './frontend-config.actions';
import {
  frontendConfigFeature,
  selectFrontendConfigLoading,
  selectFrontendConfigSaving,
  selectFrontendConfigs,
} from './frontend-config.feature';
import { initialState } from './frontend-config.state';

describe('frontendConfigFeature', () => {
  it('has the expected initial state and selectors', () => {
    expect(frontendConfigFeature.reducer(undefined, { type: '@@init' })).toEqual(initialState);
    const state = {
      frontendConfig: {
        ...initialState,
        configs: [{ id: 'site_name' } as never],
        publicConfigs: [{ variableName: 'fairgate_url', value: 'https://fairgate.example' }],
        loadStatus: 'loading' as const,
        saveStatus: 'loading' as const,
      },
    };
    expect(selectFrontendConfigs(state)).toEqual([{ id: 'site_name' }]);
    expect(frontendConfigFeature.selectPublicConfigs(state)).toEqual([
      { variableName: 'fairgate_url', value: 'https://fairgate.example' },
    ]);
    expect(selectFrontendConfigLoading(state)).toBe(true);
    expect(selectFrontendConfigSaving(state)).toBe(true);
  });

  it('updates configs and loading/saving flags for all actions', () => {
    const config = { id: 'site_name' } as never;
    expect(frontendConfigFeature.reducer(initialState, FrontendConfigActions.load).loadStatus).toBe('loading');
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, loadStatus: 'loading' },
        FrontendConfigActions.loadSuccess({ configs: [config] }),
      ).configs,
    ).toEqual([config]);
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, loadStatus: 'loading' },
        FrontendConfigActions.loadFailure({ errorCode: 'FAILED' }),
      ).loadStatus,
    ).toBe('error');
    expect(
      frontendConfigFeature.reducer(initialState, FrontendConfigActions.save({ configs: [] }))
        .saveStatus,
    ).toBe('loading');
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, saveStatus: 'loading' },
        FrontendConfigActions.saveSuccess({ configs: [config] }),
      ).configs,
    ).toEqual([config]);
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, saveStatus: 'loading' },
        FrontendConfigActions.saveFailure({ errorCode: 'FAILED' }),
      ).saveStatus,
    ).toBe('error');
  });
});
