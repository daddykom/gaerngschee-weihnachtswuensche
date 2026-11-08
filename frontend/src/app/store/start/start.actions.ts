import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { StartForm } from './start.state';

export const StartActions = createActionGroup({
  source: 'Start',
  events: {
    'Form Changed': props<{ changes: Partial<StartForm> }>(),
    Submit: props<{ email: string; language: string }>(),
    'Submit Success': props<{ sent: boolean }>(),
    'Submit Failure': emptyProps(),
  },
});
