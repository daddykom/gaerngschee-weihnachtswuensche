import { createActionGroup, props } from '@ngrx/store';
import { FairgateTestResult } from '../../shared/services/fairgate-test.service';

export const FairgateLookupActions = createActionGroup({
  source: 'Fairgate Lookup',
  events: {
    Lookup: props<{ email: string; membership?: string }>(),
    'Lookup Success': props<{ result: FairgateTestResult }>(),
    'Lookup Failure': props<{ errorCode: string }>(),
  },
});
