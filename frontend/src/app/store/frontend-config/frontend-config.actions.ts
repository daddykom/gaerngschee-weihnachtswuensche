import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { FrontendConfig, PublicFrontendConfig } from '../../shared/models/frontend-config.model';
import { FrontendConfigForm } from './frontend-config.state';

export const FrontendConfigActions = createActionGroup({
  source: 'Frontend Configuration',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ configs: FrontendConfig[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    'Form Changed': props<{ changes: FrontendConfigForm }>(),
    Save: props<{ configs: Array<{ id: string; value: string | string[] }> }>(),
    'Save Success': props<{ configs: FrontendConfig[] }>(),
    'Save Failure': props<{ errorCode: string }>(),
    'Load Public': emptyProps(),
    'Load Public Success': props<{ configs: PublicFrontendConfig[] }>(),
    'Load Public Failure': props<{ errorCode: string }>(),
  },
});
