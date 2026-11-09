import { createFeature, createReducer, on } from '@ngrx/store';
import { EmailTestActions } from './email-test.actions';
import { EmailTestState, initialState } from './email-test.state';

export const emailTestFeature = createFeature({
  name: 'emailTest',
  reducer: createReducer<EmailTestState>(
    initialState,
    on(EmailTestActions.load, (state) => ({ ...state, status: 'loading', errorCode: null })),
    on(EmailTestActions.loadSuccess, (state, { templates }) => ({
      ...state,
      status: 'loaded',
      templates,
      errorCode: null,
      form:
        state.form.template || templates.length === 0
          ? state.form
          : {
              ...state.form,
              template: templates[0].id,
              parameters: templates[0].fields.reduce<Record<string, string>>(
                (parameters, field) => ({ ...parameters, [field.key]: '' }),
                {},
              ),
            },
    })),
    on(EmailTestActions.loadFailure, (state, { errorCode }) => ({
      ...state,
      status: 'error',
      errorCode,
    })),
    on(EmailTestActions.formChanged, (state, { changes }) => ({
      ...state,
      form: { ...state.form, ...changes },
      status: state.status === 'sent' ? 'loaded' : state.status,
    })),
    on(EmailTestActions.send, (state, { form }) => ({
      ...state,
      form,
      status: 'sending',
      errorCode: null,
    })),
    on(EmailTestActions.sendSuccess, (state) => ({ ...state, status: 'sent', errorCode: null })),
    on(EmailTestActions.sendFailure, (state, { errorCode }) => ({
      ...state,
      status: 'error',
      errorCode,
    })),
  ),
});

export const {
  name: emailTestFeatureName,
  selectStatus: selectEmailTestStatus,
  selectTemplates: selectEmailTestTemplates,
  selectForm: selectEmailTestForm,
  selectErrorCode: selectEmailTestErrorCode,
} = emailTestFeature;
