import { AuthActions } from './auth.actions';
import { authReducer } from './auth.feature';
import { initialState, loggedOutState } from './auth.state';

describe('authReducer', () => {
  it('starts loading and clears the previous error on login', () => {
    const state = authReducer(
      { ...initialState, errorCode: 'INVALID_CREDENTIALS' },
      AuthActions.login({ email: 'user@example.com', password: 'secret' }),
    );

    expect(state).toEqual({
      loginForm: { email: 'user@example.com', password: 'secret' },
      passwordChangeForm: { newPassword: '', passwordConfirmation: '' },
      userId: null,
      group: null,
      requiredPasswordReset: false,
      firstAccess: false,
      passwordChangeLoading: false,
      passwordChangeErrorCode: null,
      loading: true,
      emailCheckLoading: false,
      emailCheckMode: null,
      emailCheckEmail: null,
      emailCheckYear: null,
      emailCheckErrorCode: null,
      errorCode: null,
      registrationLoginLoading: false,
      registrationLoginErrorCode: null,
      fairgateUserExists: null,
      fairgateStatus: null,
      childrenCount: null,
      adultsCount: null,
      salutation: null,
      sessionExpiresAt: null,
      sessionSecondsRemaining: null,
      sessionWarningVisible: false,
      sessionRefreshLoading: false,
      email: null,
    });
  });

  it('stores the user and group after a successful login', () => {
    const state = authReducer(
      { ...initialState, loading: true },
      AuthActions.loginSuccess({
        userId: 'user-123',
        group: 'admin',
        requiredPasswordReset: false,
      }),
    );

    expect(state).toEqual({
      loginForm: { email: '', password: '' },
      passwordChangeForm: { newPassword: '', passwordConfirmation: '' },
      userId: 'user-123',
      group: 'admin',
      requiredPasswordReset: false,
      firstAccess: false,
      passwordChangeLoading: false,
      passwordChangeErrorCode: null,
      loading: false,
      emailCheckLoading: false,
      emailCheckMode: null,
      emailCheckEmail: null,
      emailCheckYear: null,
      emailCheckErrorCode: null,
      errorCode: null,
      registrationLoginLoading: false,
      registrationLoginErrorCode: null,
      fairgateUserExists: null,
      fairgateStatus: null,
      childrenCount: null,
      adultsCount: null,
      salutation: null,
      sessionExpiresAt: null,
      sessionSecondsRemaining: null,
      sessionWarningVisible: false,
      sessionRefreshLoading: false,
      email: null,
    });
  });

  it('stores the error code after a failed login', () => {
    const state = authReducer(
      { ...initialState, loading: true },
      AuthActions.loginFailure({ errorCode: 'INVALID_CREDENTIALS' }),
    );

    expect(state).toEqual({
      loginForm: { email: '', password: '' },
      passwordChangeForm: { newPassword: '', passwordConfirmation: '' },
      userId: null,
      group: null,
      requiredPasswordReset: false,
      firstAccess: false,
      passwordChangeLoading: false,
      passwordChangeErrorCode: null,
      loading: false,
      emailCheckLoading: false,
      emailCheckMode: null,
      emailCheckEmail: null,
      emailCheckYear: null,
      emailCheckErrorCode: null,
      errorCode: 'INVALID_CREDENTIALS',
      registrationLoginLoading: false,
      registrationLoginErrorCode: null,
      fairgateUserExists: null,
      fairgateStatus: null,
      childrenCount: null,
      adultsCount: null,
      salutation: null,
      sessionExpiresAt: null,
      sessionSecondsRemaining: null,
      sessionWarningVisible: false,
      sessionRefreshLoading: false,
      email: null,
    });
  });

  it('clears authentication data on logout', () => {
    const state = authReducer(
      {
        loginForm: { email: '', password: '' },
        passwordChangeForm: { newPassword: '', passwordConfirmation: '' },
        userId: 'user-123',
        group: 'admin',
        requiredPasswordReset: false,
        passwordChangeLoading: false,
        passwordChangeErrorCode: null,
        loading: false,
        emailCheckLoading: false,
        emailCheckMode: null,
        emailCheckEmail: null,
        emailCheckYear: null,
        emailCheckErrorCode: null,
        errorCode: null,
        registrationLoginLoading: false,
        registrationLoginErrorCode: null,
        firstAccess: false,
        fairgateUserExists: null,
        fairgateStatus: null,
        childrenCount: null,
        adultsCount: null,
        salutation: null,
        sessionExpiresAt: null,
        sessionSecondsRemaining: null,
        sessionWarningVisible: false,
        sessionRefreshLoading: false,
        email: null,
      },
      AuthActions.logoutRequested(),
    );

    expect(state).toEqual(loggedOutState);
  });

  it('stores registration login data and resets its loading state', () => {
    const loading = authReducer(
      initialState,
      AuthActions.registrationLogin({ token: 'registration-token' }),
    );
    expect(loading.registrationLoginLoading).toBe(true);
    expect(loading.registrationLoginErrorCode).toBeNull();

    const state = authReducer(
      loading,
      AuthActions.registrationLoginSuccess({
        userId: 'client-1',
        email: 'client@example.com',
        group: 'wunschbesteller',
        firstAccess: true,
        fairgateUserExists: true,
        childrenCount: 2,
        adultsCount: 2,
        salutation: 'Hallo',
      }),
    );
    expect(state).toMatchObject({
      userId: 'client-1',
      group: 'wunschbesteller',
      registrationLoginLoading: false,
      registrationLoginErrorCode: null,
      fairgateUserExists: true,
      childrenCount: 2,
      adultsCount: 2,
      salutation: 'Hallo',
    });
  });

  it('stores registration and password change errors', () => {
    const registration = authReducer(
      { ...initialState, registrationLoginLoading: true },
      AuthActions.registrationLoginFailure({ errorCode: 'TOKEN_EXPIRED' }),
    );
    expect(registration).toMatchObject({
      userId: null,
      group: null,
      registrationLoginLoading: false,
      registrationLoginErrorCode: 'TOKEN_EXPIRED',
    });

    const changing = authReducer(initialState, AuthActions.passwordChange({ password: 'secret' }));
    expect(changing).toMatchObject({ passwordChangeLoading: true, passwordChangeErrorCode: null });
    const failed = authReducer(
      changing,
      AuthActions.passwordChangeFailure({ errorCode: 'WEAK_PASSWORD' }),
    );
    expect(failed).toMatchObject({
      passwordChangeLoading: false,
      passwordChangeErrorCode: 'WEAK_PASSWORD',
    });
    const changed = authReducer(
      { ...failed, requiredPasswordReset: true },
      AuthActions.passwordChangeSuccess(),
    );
    expect(changed).toMatchObject({
      requiredPasswordReset: false,
      passwordChangeLoading: false,
      passwordChangeErrorCode: null,
    });
  });
});
