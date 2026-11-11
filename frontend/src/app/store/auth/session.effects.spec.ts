import { HttpErrorResponse } from '@angular/common/http';
import { Actions } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { AuthActions } from './auth.actions';
import { SessionActions } from './session.actions';
import {
  countdownSession$,
  pollSessionStatus$,
  refreshSession$,
  requestSessionStatus$,
  startSessionPollingOnLogin$,
  stopSessionPollingOnLogout$,
} from './session.effects';

describe('session monitoring during registration login', () => {
  let actions$: Actions;
  let source: Subject<Action>;

  beforeEach(() => {
    source = new Subject<Action>();
    actions$ = new Actions(source);
    vi.useFakeTimers();
  });

  afterEach(() => {
    source.complete();
    vi.useRealTimers();
  });

  it('stops old polling and restarts only after successful registration login', () => {
    const stopped = vi.fn();
    const started = vi.fn();
    const statusRequested = vi.fn();
    const subscriptions = [
      stopSessionPollingOnLogout$(actions$).subscribe(stopped),
      startSessionPollingOnLogin$(actions$).subscribe(started),
      pollSessionStatus$(actions$).subscribe(statusRequested),
    ];

    source.next(SessionActions.pollingStarted());
    vi.advanceTimersByTime(0);
    expect(statusRequested).toHaveBeenCalledTimes(1);
    source.next(AuthActions.registrationLogin({ token: 'new-token' }));
    expect(stopped).toHaveBeenCalledWith(SessionActions.pollingStopped());
    vi.advanceTimersByTime(30_000);
    expect(statusRequested).toHaveBeenCalledTimes(1);
    expect(started).not.toHaveBeenCalled();

    source.next(
      AuthActions.registrationLoginSuccess({
        userId: 'client-1',
        email: 'client@example.com',
        group: 'wunschbesteller',
        fairgateUserExists: true,
        childrenCount: 1,
        adultsCount: 1,
        salutation: 'Hallo',
        firstAccess: true,
      }),
    );
    expect(started).toHaveBeenCalledWith(SessionActions.pollingStarted());
    source.next(SessionActions.pollingStarted());
    vi.advanceTimersByTime(0);
    expect(statusRequested).toHaveBeenCalledTimes(2);
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });

  it.each(['status', 'refresh'] as const)(
    'cancels an in-flight old %s request before it can expire the new login',
    (kind) => {
      const response = new Subject<never>();
      const cancelled = vi.fn();
      const request = new Observable<never>((subscriber) => {
        const subscription = response.subscribe(subscriber);
        return () => {
          cancelled();
          subscription.unsubscribe();
        };
      });
      const authService = {
        sessionStatus: () => request,
        refreshSession: () => request,
      } as unknown as AuthService;
      const output = vi.fn();
      const effect: Observable<Action> =
        kind === 'status'
          ? requestSessionStatus$(actions$, authService)
          : refreshSession$(actions$, authService);
      const subscription = effect.subscribe(output);

      source.next(
        kind === 'status' ? SessionActions.statusRequested() : SessionActions.refreshRequested(),
      );
      source.next(AuthActions.registrationLogin({ token: 'new-token' }));
      expect(cancelled).toHaveBeenCalledTimes(1);
      response.error(
        new HttpErrorResponse({
          status: 401,
          error: { error: { code: 'SESSION_EXPIRED' } },
        }),
      );
      expect(output).not.toHaveBeenCalled();
      subscription.unsubscribe();
    },
  );

  it('cancels an old countdown when registration login starts', () => {
    const output = vi.fn();
    const subscription = countdownSession$(actions$).subscribe(output);
    source.next(
      SessionActions.countdownStarted({ expiresAt: new Date(Date.now() + 2_000).toISOString() }),
    );
    vi.advanceTimersByTime(0);
    expect(output).toHaveBeenCalledTimes(1);
    source.next(AuthActions.registrationLogin({ token: 'new-token' }));
    vi.advanceTimersByTime(5_000);
    expect(output).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });
});
