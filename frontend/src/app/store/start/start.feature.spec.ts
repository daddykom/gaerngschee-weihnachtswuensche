import { StartActions } from './start.actions';
import { startReducer } from './start.feature';
import { initialState } from './start.state';

describe('startReducer', () => {
  it('sets loading when an email is submitted', () => {
    const state = startReducer(
      initialState,
      StartActions.submit({ email: 'person@example.com', language: 'de' }),
    );

    expect(state).toEqual({ loading: true, sent: null });
  });

  it('stores a successful response', () => {
    const state = startReducer(
      { loading: true, sent: null },
      StartActions.submitSuccess({ sent: true }),
    );

    expect(state).toEqual({ loading: false, sent: true });
  });

  it('stores a failed response', () => {
    const state = startReducer({ loading: true, sent: null }, StartActions.submitFailure());

    expect(state).toEqual({ loading: false, sent: false });
  });
});
