import { createFeature, createReducer, on } from '@ngrx/store';
import { FrontendConfigActions } from './frontend-config.actions';
import { FrontendConfigState, initialState } from './frontend-config.state';

export const frontendConfigFeature = createFeature({
  name: 'frontendConfig',
  reducer: createReducer<FrontendConfigState>(
    initialState,
    on(FrontendConfigActions.load, (state) => ({ ...state, loadStatus: 'loading', errorCode: null })),
    on(FrontendConfigActions.loadSuccess, (state, { configs }) => ({
      ...state,
      configs,
      loadStatus: 'success',
    })),
    on(FrontendConfigActions.loadFailure, (state, { errorCode }) => ({ ...state, loadStatus: 'error', errorCode })),
    on(FrontendConfigActions.save, (state) => ({ ...state, saveStatus: 'loading', errorCode: null })),
    on(FrontendConfigActions.saveSuccess, (state, { configs }) => ({
      ...state,
      configs,
      saveStatus: 'success',
    })),
    on(FrontendConfigActions.saveFailure, (state, { errorCode }) => ({ ...state, saveStatus: 'error', errorCode })),
    on(FrontendConfigActions.loadPublic, (state) => ({
      ...state,
      publicStatus: 'loading',
      publicErrorCode: null,
    })),
    on(FrontendConfigActions.loadPublicSuccess, (state, { configs }) => ({
      ...state,
      publicConfigs: configs,
      publicStatus: 'loaded',
      publicErrorCode: null,
    })),
    on(FrontendConfigActions.loadPublicFailure, (state, { errorCode }) => ({
      ...state,
      publicStatus: 'error',
      publicErrorCode: errorCode,
    })),
  ),
});

export const {
  name: frontendConfigFeatureName,
  reducer: frontendConfigReducer,
  selectConfigs: selectFrontendConfigs,
  selectPublicConfigs: selectFrontendPublicConfigs,
  selectLoadStatus: selectFrontendConfigLoadStatus,
  selectSaveStatus: selectFrontendConfigSaveStatus,
  selectPublicStatus: selectFrontendPublicConfigStatus,
  selectPublicErrorCode: selectFrontendPublicConfigErrorCode,
} = frontendConfigFeature;

export const selectFrontendConfigLoading = (state: { frontendConfig: FrontendConfigState }): boolean =>
  state.frontendConfig.loadStatus === 'loading';

export const selectFrontendConfigSaving = (state: { frontendConfig: FrontendConfigState }): boolean =>
  state.frontendConfig.saveStatus === 'loading';
