import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { type Mock } from 'vitest';
import { AuthService } from '../../shared/services/auth.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { AuthActions } from './auth.actions';
import {
  authNotificationEffect,
  clearPersistedAuthEffect,
  emailCheckSuccessNotificationEffect,
  loginEffect,
  logoutEffect,
  navigateOnEmailCheckSuccessEffect,
  navigateOnLoginSuccessEffect,
  navigateOnPasswordChangeSuccessEffect,
  passwordChangeEffect,
  persistLoginEffect,
  persistRegistrationLoginEffect,
} from './auth.effects';

describe('loginEffect', () => {
  let actions$: Subject<Action>;
  let authService: { login: Mock; registrationLogin: Mock; logout: Mock; changePassword: Mock };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    authService = {
      login: vi.fn(),
      registrationLogin: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('maps a successful login to a success action', async () => {
    authService.login.mockReturnValue(
      of({
        user: { id: 'user-123', email: 'user@example.com', group: 'admin' },
        group: 'admin',
        requiredPasswordReset: false,
        email: 'user@example.com',
      }),
    );
    const effect$ = TestBed.runInInjectionContext(() => loginEffect());
    const result = firstValueFrom(effect$);

    actions$.next(AuthActions.login({ email: 'user@example.com', password: 'secret' }));

    await expect(result).resolves.toEqual(
      AuthActions.loginSuccess({
        userId: 'user-123',
        group: 'admin',
        requiredPasswordReset: false,
        email: 'user@example.com',
      }),
    );
    expect(authService.login).toHaveBeenCalledWith('user@example.com', 'secret');
  });

  it('uses the submitted email when the response does not provide one', async () => {
    authService.login.mockReturnValue(
      of({
        user: { id: 'user-123', email: '', group: 'admin' },
        group: 'admin',
        requiredPasswordReset: false,
      }),
    );
    const effect$ = TestBed.runInInjectionContext(() => loginEffect());
    const result = firstValueFrom(effect$);

    actions$.next(AuthActions.login({ email: 'user@example.com', password: 'secret' }));

    await expect(result).resolves.toEqual(
      AuthActions.loginSuccess({
        userId: 'user-123',
        group: 'admin',
        requiredPasswordReset: false,
        email: 'user@example.com',
      }),
    );
  });

  it('maps a structured backend error to a failure action', async () => {
    authService.login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { error: { code: 'INVALID_CREDENTIALS', details: [] } },
          }),
      ),
    );
    const effect$ = TestBed.runInInjectionContext(() => loginEffect());
    const result = firstValueFrom(effect$);

    actions$.next(AuthActions.login({ email: 'user@example.com', password: 'wrong' }));

    await expect(result).resolves.toEqual(
      AuthActions.loginFailure({ errorCode: 'INVALID_CREDENTIALS' }),
    );
  });

  it('uses the fallback error code for an unstructured login error', async () => {
    authService.login.mockReturnValue(throwError(() => new Error('failed')));
    const result = firstValueFrom(TestBed.runInInjectionContext(() => loginEffect()));

    actions$.next(AuthActions.login({ email: 'user@example.com', password: 'wrong' }));

    await expect(result).resolves.toEqual(AuthActions.loginFailure({ errorCode: 'LOGIN_FAILED' }));
  });

  it('dispatches navigation to the admin overview after a successful login', async () => {
    const effect$ = TestBed.runInInjectionContext(() => navigateOnLoginSuccessEffect());
    const result = firstValueFrom(effect$);

    actions$.next(
      AuthActions.loginSuccess({
        userId: 'user-123',
        group: 'admin',
        requiredPasswordReset: false,
      }),
    );

    await expect(result).resolves.toEqual(
      NavigationActions.navigate({ target: '/admin/overview' }),
    );
  });

  it('navigates clients to the start success page after an email check', async () => {
    const effect$ = TestBed.runInInjectionContext(() => navigateOnEmailCheckSuccessEffect());
    const result = firstValueFrom(effect$);

    actions$.next(
      AuthActions.checkEmailSuccess({
        email: 'client@example.com',
        mode: 'email_sent',
        processingYear: 2026,
      }),
    );

    await expect(result).resolves.toEqual(NavigationActions.navigate({ target: '/start/success' }));
  });

  it('ignores password mode when navigating after an email check', async () => {
    const effect$ = TestBed.runInInjectionContext(() => navigateOnEmailCheckSuccessEffect());
    const result = firstValueFrom(effect$);

    actions$.next(
      AuthActions.checkEmailSuccess({
        email: 'admin@example.com',
        mode: 'password',
        processingYear: 2026,
      }),
    );
    actions$.next(
      AuthActions.checkEmailSuccess({
        email: 'client@example.com',
        mode: 'info',
        processingYear: 2026,
      }),
    );

    await expect(result).resolves.toEqual(NavigationActions.navigate({ target: '/start/success' }));
  });

  it('shows a success notification with the processing year for clients', async () => {
    const effect$ = TestBed.runInInjectionContext(() => emailCheckSuccessNotificationEffect());
    const result = firstValueFrom(effect$);

    actions$.next(
      AuthActions.checkEmailSuccess({
        email: 'client@example.com',
        mode: 'info',
        processingYear: 2026,
      }),
    );

    await expect(result).resolves.toEqual(
      NotificationActions.show({
        variant: 'success',
        titleKey: 'app.anmeldung.emailSentTitle',
        messageKey: 'app.login.orderInfo',
        params: { year: '2026' },
        preserveOnRoutes: ['/start/success'],
      }),
    );
  });

  it('dispatches navigation to password change when a reset is required', async () => {
    const effect$ = TestBed.runInInjectionContext(() => navigateOnLoginSuccessEffect());
    const result = firstValueFrom(effect$);

    actions$.next(
      AuthActions.loginSuccess({
        userId: 'user-123',
        group: 'user',
        requiredPasswordReset: true,
      }),
    );

    await expect(result).resolves.toEqual(
      NavigationActions.navigate({ target: '/password-change' }),
    );
  });

  it('navigates after password change', async () => {
    const password = firstValueFrom(
      TestBed.runInInjectionContext(() => navigateOnPasswordChangeSuccessEffect()),
    );
    actions$.next(AuthActions.passwordChangeSuccess());
    await expect(password).resolves.toEqual(
      NavigationActions.navigate({ target: '/admin/overview' }),
    );
  });

  it('maps password change success and errors', async () => {
    authService.changePassword.mockReturnValue(of({ user: { id: 'user-1' } }));
    const success = firstValueFrom(TestBed.runInInjectionContext(() => passwordChangeEffect()));
    actions$.next(AuthActions.passwordChange({ password: 'new-secret' }));
    await expect(success).resolves.toEqual(AuthActions.passwordChangeSuccess());
    expect(authService.changePassword).toHaveBeenCalledWith('new-secret');

    authService.changePassword.mockReturnValue(throwError(() => new Error('failed')));
    const failure = firstValueFrom(TestBed.runInInjectionContext(() => passwordChangeEffect()));
    actions$.next(AuthActions.passwordChange({ password: 'bad-secret' }));
    await expect(failure).resolves.toEqual(
      AuthActions.passwordChangeFailure({ errorCode: 'PASSWORD_CHANGE_FAILED' }),
    );
  });

  it('calls the backend logout and dispatches navigation to home after success', async () => {
    authService.logout.mockReturnValue(of(undefined));
    const effect$ = TestBed.runInInjectionContext(() => logoutEffect());
    const result = firstValueFrom(effect$);

    actions$.next(AuthActions.logoutRequested());

    expect(authService.logout).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toEqual(NavigationActions.navigate({ target: '/' }));
  });

  it('dispatches navigation to home when the backend logout fails', async () => {
    authService.logout.mockReturnValue(throwError(() => new Error('Logout failed')));
    const effect$ = TestBed.runInInjectionContext(() => logoutEffect());
    const result = firstValueFrom(effect$);

    actions$.next(AuthActions.logoutRequested());

    expect(authService.logout).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toEqual(NavigationActions.navigate({ target: '/' }));
  });

  it('persists login state and clears it on logout', () => {
    localStorage.removeItem('gaerngschee.auth');
    const persistResult = TestBed.runInInjectionContext(() => persistLoginEffect());
    const clearResult = TestBed.runInInjectionContext(() => clearPersistedAuthEffect());

    const loginSubscription = persistResult.subscribe();
    actions$.next(
      AuthActions.loginSuccess({
        userId: 'user-1',
        email: 'admin@example.com',
        group: 'admin',
        requiredPasswordReset: false,
      }),
    );
    expect(JSON.parse(localStorage.getItem('gaerngschee.auth') ?? '{}')).toEqual({
      userId: 'user-1',
      group: 'admin',
      email: 'admin@example.com',
      fairgateUserExists: null,
      fairgateStatus: null,
      childrenCount: null,
      adultsCount: null,
      salutation: null,
    });
    const logoutSubscription = clearResult.subscribe();
    actions$.next(AuthActions.logoutRequested());

    expect(localStorage.getItem('gaerngschee.auth')).toBeNull();
    loginSubscription.unsubscribe();
    logoutSubscription.unsubscribe();
  });

  it('persists registration data', () => {
    localStorage.removeItem('gaerngschee.auth');
    const effect$ = TestBed.runInInjectionContext(() => persistRegistrationLoginEffect());
    const subscription = effect$.subscribe();

    actions$.next(
      AuthActions.registrationLoginSuccess({
        userId: 'client-1',
        email: 'client@example.com',
        group: 'wunschbesteller',
        firstAccess: true,
        fairgateUserExists: true,
        childrenCount: 1,
        adultsCount: 2,
        salutation: 'Hallo',
      }),
    );

    expect(JSON.parse(localStorage.getItem('gaerngschee.auth') ?? '{}')).toEqual({
      userId: 'client-1',
      email: 'client@example.com',
      group: 'wunschbesteller',
      fairgateUserExists: true,
      childrenCount: 1,
      adultsCount: 2,
      salutation: 'Hallo',
    });
    subscription.unsubscribe();
  });

  it('creates notifications for login and password failures', async () => {
    const effect$ = TestBed.runInInjectionContext(() => authNotificationEffect());
    const result = firstValueFrom(effect$);
    actions$.next(AuthActions.loginFailure({ errorCode: 'INVALID_CREDENTIALS' }));
    await expect(result).resolves.toEqual(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.auth.loginErrorTitle',
        messageKey: 'app.auth.errors.INVALID_CREDENTIALS',
      }),
    );

    const passwordResult = firstValueFrom(effect$);
    actions$.next(AuthActions.passwordChangeFailure({ errorCode: 'WEAK_PASSWORD' }));
    await expect(passwordResult).resolves.toEqual(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.passwordChange.heading',
        messageKey: 'app.passwordChange.errors.WEAK_PASSWORD',
      }),
    );
  });
});
