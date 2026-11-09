import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { EmailTestForm, EmailTestTemplate } from '../../shared/services/email-test.service';

export const EmailTestActions = createActionGroup({
  source: 'Email Test',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ templates: EmailTestTemplate[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    'Form Changed': props<{ changes: Partial<EmailTestForm> }>(),
    Send: props<{ form: EmailTestForm }>(),
    'Send Success': props<{ emailSentTo: string }>(),
    'Send Failure': props<{ errorCode: string }>(),
  },
});
