import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Route, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthService, RegistrationLoginResponse } from '../../../shared/services/auth.service';
import { AuthActions } from '../../../store/auth/auth.actions';
import { clientLoginGuard } from './client-login.guard';

describe('clientLoginGuard', () => {
  const redirect = { url: '/start' };
  const orderRedirect = { url: '/bestellung' };
  const router = {
    getCurrentNavigation: vi.fn(() => ({ initialUrl: { queryParams: { token: 'registration-token' } } })),
    url: '/client-login',
    parseUrl: vi.fn((url: string) => url === '/bestellung' ? orderRedirect : redirect),
  };
  const store = { dispatch: vi.fn() };
  const response: RegistrationLoginResponse = {
    user: { id: 'client-1', email: 'client@example.com', group: 'client' },
    group: 'client',
    requiredPasswordReset: false,
    fairgateStatus: 'valid',
    fairgateUserExists: true,
    childrenCount: 1,
    adultsCount: 2,
    salutation: 'Hallo',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }, { provide: Store, useValue: store }] });
  });

  it('redirects to the order page and stores a successful registration login', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { registrationLogin: vi.fn(() => of(response)) } }] });

    const result = TestBed.runInInjectionContext(() => clientLoginGuard({} as Route, [], {} as never));

    await expect(firstValueFrom(result as ReturnType<typeof of>)).resolves.toEqual(orderRedirect);
    expect(store.dispatch).toHaveBeenCalledWith(AuthActions.registrationLoginSuccess({
      userId: 'client-1',
      email: 'client@example.com',
      group: 'client',
      fairgateStatus: 'valid',
      fairgateUserExists: true,
      childrenCount: 1,
      adultsCount: 2,
      salutation: 'Hallo',
    }));
  });

  it('redirects to start and stores the backend error for an invalid token', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { registrationLogin: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 401, error: { error: { code: 'INVALID_REGISTRATION_TOKEN' } } }))) } }] });

    const result = TestBed.runInInjectionContext(() => clientLoginGuard({} as Route, [], {} as never));

    await expect(firstValueFrom(result as ReturnType<typeof of>)).resolves.toEqual(redirect);
    expect(store.dispatch).toHaveBeenCalledWith(AuthActions.registrationLoginFailure({ errorCode: 'INVALID_REGISTRATION_TOKEN' }));
  });

  it('redirects to start without calling the backend when the token is missing', () => {
    router.getCurrentNavigation.mockReturnValue({ initialUrl: { queryParams: {} } } as never);
    const auth = { registrationLogin: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });

    const result = TestBed.runInInjectionContext(() => clientLoginGuard({} as Route, [], {} as never));

    expect(result).toEqual(redirect);
    expect(auth.registrationLogin).not.toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith(AuthActions.registrationLoginFailure({ errorCode: 'INVALID_REGISTRATION_TOKEN' }));
  });
});
