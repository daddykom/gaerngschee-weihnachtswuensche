import { StartActions } from './start.actions';
import { startReducer } from './start.feature';
import { initialState } from './start.state';

describe('startReducer', () => {
  it('sets loading when an email is submitted', () => {
    const state = startReducer(
      initialState,
      StartActions.submit({ email: 'person@example.com', language: 'de' }),
    );

    expect(state).toEqual({
      status: 'loading',
      sent: null,
      errorCode: null,
      form: { email: 'person@example.com', privacyAccepted: false, language: 'de' },
    });
  });

  it('stores a successful response', () => {
    const state = startReducer(
      {
        status: 'loading',
        sent: null,
        errorCode: null,
        form: { email: '', privacyAccepted: false, language: 'de' },
      },
      StartActions.submitSuccess({ sent: true }),
    );

    expect(state).toEqual({
      status: 'success',
      sent: true,
      errorCode: null,
      form: { email: '', privacyAccepted: false, language: 'de' },
    });
  });

  it('stores a failed response with its error code', () => {
    const state = startReducer(
      {
        status: 'loading',
        sent: null,
        errorCode: null,
        form: { email: '', privacyAccepted: false, language: 'de' },
      },
      StartActions.submitFailure({ errorCode: 'CAMPAIGN_CAPACITY_REACHED' }),
    );

    expect(state).toEqual({
      status: 'error',
      sent: false,
      errorCode: 'CAMPAIGN_CAPACITY_REACHED',
      form: { email: '', privacyAccepted: false, language: 'de' },
    });
  });
});
