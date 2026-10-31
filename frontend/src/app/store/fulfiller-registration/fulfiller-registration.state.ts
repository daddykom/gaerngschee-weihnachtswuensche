export interface FulfillerRegistrationForm {
  email: string;
  privacyAccepted: boolean;
  language: string;
}

export interface FulfillerRegistrationState {
  status: 'initial' | 'loading' | 'success' | 'error';
  errorCode: string | null;
  form: FulfillerRegistrationForm;
}

export const initialState: FulfillerRegistrationState = {
  status: 'initial',
  errorCode: null,
  form: { email: '', privacyAccepted: false, language: 'de' },
};
