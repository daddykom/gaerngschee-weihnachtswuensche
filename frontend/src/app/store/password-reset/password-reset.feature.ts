import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthActions } from '../auth/auth.actions';

export interface PasswordResetState {
  requestStatus: 'initial' | 'loading' | 'success' | 'error';
  requestSent: boolean;
  resetStatus: 'initial' | 'loading' | 'success' | 'error';
}

const initialState: PasswordResetState = {
  requestStatus: 'initial',
  requestSent: false,
  resetStatus: 'initial',
};

export const passwordResetFeature = createFeature({
  name: 'passwordReset',
  reducer: createReducer(
    initialState,
    on(AuthActions.passwordResetRequest, (state) => ({
      ...state,
      requestStatus: 'loading',
      requestSent: false,
    })),
    on(AuthActions.passwordResetRequestSuccess, (state) => ({
      ...state,
      requestStatus: 'success',
      requestSent: true,
    })),
    on(AuthActions.passwordResetRequestFailure, (state) => ({ ...state, requestStatus: 'error' })),
    on(AuthActions.passwordReset, (state) => ({ ...state, resetStatus: 'loading' })),
    on(AuthActions.passwordResetSuccess, (state) => ({ ...state, resetStatus: 'success' })),
    on(AuthActions.passwordResetFailure, (state) => ({ ...state, resetStatus: 'error' })),
  ),
});

export const {
  selectRequestStatus: selectPasswordResetRequestStatus,
  selectRequestSent: selectPasswordResetRequestSent,
  selectResetStatus: selectPasswordResetStatus,
} = passwordResetFeature;

export const selectPasswordResetRequestLoading = (state: {
  passwordReset: PasswordResetState;
}): boolean => state.passwordReset.requestStatus === 'loading';

export const selectPasswordResetLoading = (state: { passwordReset: PasswordResetState }): boolean =>
  state.passwordReset.resetStatus === 'loading';
