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
    'Build hint received': props<{ buildId: string }>(),
    'Build detected': props<{ buildId: string }>(),
    'Reload deferred': props<{ buildId: string }>(),
    'Reload confirmed': emptyProps(),
  },
});

export interface AppUpdateState {
  pendingBuildId: string | null;
  deferredBuildId: string | null;
}

export const appUpdateFeature = createFeature({
  name: 'appUpdate',
  reducer: createReducer<AppUpdateState>(
    { pendingBuildId: null, deferredBuildId: null },
    on(AppUpdateActions.buildDetected, (state, { buildId }) => ({
      ...state,
      pendingBuildId: buildId === BUILD_INFO.buildId ? null : buildId,
    })),
    on(AppUpdateActions.reloadDeferred, (state, { buildId }) => ({
      ...state,
      deferredBuildId: buildId,
    })),
  ),
});
