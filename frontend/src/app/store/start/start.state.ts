export interface StartForm {
  email: string;
  privacyAccepted: boolean;
  language: string;
}

export interface StartState {
  status: 'initial' | 'loading' | 'success' | 'error';
  sent: boolean | null;
  errorCode: string | null;
  form: StartForm;
}

export const initialState: StartState = {
  status: 'initial',
  sent: null,
  errorCode: null,
  form: { email: '', privacyAccepted: false, language: 'de' },
};
