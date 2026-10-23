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
        loading: true,
        saving: true,
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
    expect(frontendConfigFeature.reducer(initialState, FrontendConfigActions.load).loading).toBe(
      true,
    );
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, loading: true },
        FrontendConfigActions.loadSuccess({ configs: [config] }),
      ).configs,
    ).toEqual([config]);
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, loading: true },
        FrontendConfigActions.loadFailure({ errorCode: 'FAILED' }),
      ).loading,
    ).toBe(false);
    expect(
      frontendConfigFeature.reducer(initialState, FrontendConfigActions.save({ configs: [] }))
        .saving,
    ).toBe(true);
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, saving: true },
        FrontendConfigActions.saveSuccess({ configs: [config] }),
      ).configs,
    ).toEqual([config]);
    expect(
      frontendConfigFeature.reducer(
        { ...initialState, saving: true },
        FrontendConfigActions.saveFailure({ errorCode: 'FAILED' }),
      ).saving,
    ).toBe(false);
  });
});
