import { createFeature, createReducer, on } from '@ngrx/store';
import { FulfillerRegistrationActions } from './fulfiller-registration.actions';
import { initialState } from './fulfiller-registration.state';

export const fulfillerRegistrationFeature = createFeature({
  name: 'fulfillerRegistration',
  reducer: createReducer(
    initialState,
    on(FulfillerRegistrationActions.formChanged, (state, { changes }) => ({
      ...state,
      form: { ...state.form, ...changes },
    })),
    on(FulfillerRegistrationActions.submit, (state, { email, privacyAccepted, language }) => ({
      ...state,
      status: 'loading' as const,
      errorCode: null,
      form: { email, privacyAccepted, language },
    })),
    on(FulfillerRegistrationActions.submitSuccess, (state) => ({
      ...state,
      status: 'success' as const,
    })),
    on(FulfillerRegistrationActions.submitFailure, (state, { errorCode }) => ({
      ...state,
      status: 'error' as const,
      errorCode,
    })),
  ),
});

export const {
  selectForm: selectFulfillerRegistrationForm,
  selectStatus: selectFulfillerRegistrationStatus,
} = fulfillerRegistrationFeature;
