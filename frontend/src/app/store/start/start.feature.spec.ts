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
      form: { email: 'person@example.com', language: 'de' },
    });
  });

  it('stores a successful response', () => {
    const state = startReducer(
      { status: 'loading', sent: null, form: { email: '', language: 'de' } },
      StartActions.submitSuccess({ sent: true }),
    );

    expect(state).toEqual({ status: 'success', sent: true, form: { email: '', language: 'de' } });
  });

  it('stores a failed response', () => {
    const state = startReducer(
      { status: 'loading', sent: null, form: { email: '', language: 'de' } },
      StartActions.submitFailure(),
    );

    expect(state).toEqual({ status: 'error', sent: false, form: { email: '', language: 'de' } });
  });
});
