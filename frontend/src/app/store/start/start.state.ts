export interface StartForm {
  email: string;
  language: string;
}

export interface StartState {
  status: 'initial' | 'loading' | 'success' | 'error';
  sent: boolean | null;
  form: StartForm;
}

export const initialState: StartState = {
  status: 'initial',
  sent: null,
  form: { email: '', language: 'de' },
};
