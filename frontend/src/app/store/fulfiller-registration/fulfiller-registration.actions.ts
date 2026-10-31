import { createActionGroup, props } from '@ngrx/store';

export const FulfillerRegistrationActions = createActionGroup({
  source: 'Fulfiller Registration',
  events: {
    'Form Changed': props<{ changes: Partial<{ email: string; privacyAccepted: boolean }> }>(),
    Submit: props<{ email: string; privacyAccepted: boolean; language: string }>(),
    'Submit Success': props<{ sent: boolean }>(),
    'Submit Failure': props<{ errorCode: string }>(),
  },
});
