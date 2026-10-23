import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { firstValueFrom, throwError } from 'rxjs';
import { SessionActions } from '../../store/auth/session.actions';
import { authSessionInterceptor } from './auth-session.interceptor';

describe('authSessionInterceptor', () => {
  it('dispatches sessionExpired for the session expiration response', async () => {
    const store = { dispatch: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: Store, useValue: store }] });
    const error = new HttpErrorResponse({
      status: 401,
      error: { error: { code: 'SESSION_EXPIRED' } },
    });
    const request = new HttpRequest('GET', '/protected');

    await expect(
      firstValueFrom(
        TestBed.runInInjectionContext(() =>
          authSessionInterceptor(request, () => throwError(() => error)),
        ),
      ),
    ).rejects.toBe(error);
    expect(store.dispatch).toHaveBeenCalledWith(SessionActions.sessionExpired());
  });

  it('does not dispatch for other unauthorized responses', async () => {
    const store = { dispatch: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: Store, useValue: store }] });
    const error = new HttpErrorResponse({
      status: 401,
      error: { error: { code: 'INVALID_CREDENTIALS' } },
    });

    await expect(
      firstValueFrom(
        TestBed.runInInjectionContext(() =>
          authSessionInterceptor(new HttpRequest('GET', '/login'), () => throwError(() => error)),
        ),
      ),
    ).rejects.toBe(error);
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
