import { createFeature, createReducer, on } from '@ngrx/store';
import { StartActions } from './start.actions';
import { initialState, StartState } from './start.state';

export const startFeature = createFeature({
  name: 'start',
  reducer: createReducer<StartState>(
    initialState,
    on(StartActions.formChanged, (state, { changes }) => ({
      ...state,
      form: { ...state.form, ...changes },
    })),
    on(StartActions.submit, (state, { email, language }) => ({
      ...state,
      status: 'loading',
      sent: null,
      form: { email, language },
    })),
    on(StartActions.submitSuccess, (state, { sent }) => ({
      ...state,
      status: 'success',
      sent,
    })),
    on(StartActions.submitFailure, (state) => ({
      ...state,
      status: 'error',
      sent: false,
    })),
  ),
});

export const {
  name: startFeatureName,
  reducer: startReducer,
  selectStartState,
  selectStatus: selectStartStatus,
  selectSent: selectStartSent,
  selectForm: selectStartForm,
} = startFeature;

export const selectStartLoading = (state: { start: StartState }): boolean =>
  state.start.status === 'loading';
