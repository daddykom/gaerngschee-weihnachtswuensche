export interface StartState {
  status: 'initial' | 'loading' | 'success' | 'error';
  sent: boolean | null;
}

export const initialState: StartState = {
  status: 'initial',
  sent: null,
};
