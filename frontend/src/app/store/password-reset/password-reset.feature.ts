import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthActions } from '../auth/auth.actions';

export interface PasswordResetState {
  requestLoading: boolean;
  requestSent: boolean;
  loading: boolean;
}

const initialState: PasswordResetState = {
  requestLoading: false,
  requestSent: false,
  loading: false,
};

export const passwordResetFeature = createFeature({
  name: 'passwordReset',
  reducer: createReducer(
    initialState,
    on(AuthActions.passwordResetRequest, (state) => ({
      ...state,
      requestLoading: true,
      requestSent: false,
    })),
    on(AuthActions.passwordResetRequestSuccess, (state) => ({
      ...state,
      requestLoading: false,
      requestSent: true,
    })),
    on(AuthActions.passwordResetRequestFailure, (state) => ({ ...state, requestLoading: false })),
    on(AuthActions.passwordReset, (state) => ({ ...state, loading: true })),
    on(AuthActions.passwordResetSuccess, (state) => ({ ...state, loading: false })),
    on(AuthActions.passwordResetFailure, (state) => ({ ...state, loading: false })),
  ),
});

export const {
  selectRequestLoading: selectPasswordResetRequestLoading,
  selectRequestSent: selectPasswordResetRequestSent,
  selectLoading: selectPasswordResetLoading,
} = passwordResetFeature;
