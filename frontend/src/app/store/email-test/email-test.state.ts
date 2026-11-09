import { EmailTestForm, EmailTestTemplate } from '../../shared/services/email-test.service';

export interface EmailTestState {
  status: 'initial' | 'loading' | 'loaded' | 'sending' | 'sent' | 'error';
  templates: EmailTestTemplate[];
  form: EmailTestForm;
  errorCode: string | null;
}

export const initialState: EmailTestState = {
  status: 'initial',
  templates: [],
  form: { recipient: '', template: '', parameters: {} },
  errorCode: null,
};
