import {
  createActionGroup,
  createFeature,
  createReducer,
  emptyProps,
  on,
  props,
} from '@ngrx/store';
import { BUILD_INFO } from '../../../generated/build-info';

export const AppUpdateActions = createActionGroup({
  source: 'App update',
  events: {
    'Build detected': props<{ buildId: string }>(),
    'Deferral restored': props<{ buildId: string | null }>(),
    'Reload clicked': emptyProps(),
    'Reload deferred': props<{ buildId: string }>(),
    'Reload confirmed': props<{ buildId: string }>(),
  },
});

export interface AppUpdateState {
  pendingBuildId: string | null;
  deferredBuildId: string | null;
  reloading: boolean;
}

export const initialState: AppUpdateState = {
  pendingBuildId: null,
  deferredBuildId: null,
  reloading: false,
};

export const appUpdateFeature = createFeature({
  name: 'appUpdate',
  reducer: createReducer<AppUpdateState>(
    initialState,
    on(AppUpdateActions.buildDetected, (state, { buildId }) => ({
      ...state,
      pendingBuildId: buildId === BUILD_INFO.buildId ? null : buildId,
    })),
    on(
      AppUpdateActions.deferralRestored,
      AppUpdateActions.reloadDeferred,
      (state, { buildId }) => ({
        ...state,
        deferredBuildId: buildId,
      }),
    ),
    on(AppUpdateActions.reloadConfirmed, (state) => ({ ...state, reloading: true })),
  ),
});
