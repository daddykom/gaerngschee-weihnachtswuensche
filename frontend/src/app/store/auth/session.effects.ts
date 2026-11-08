import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  catchError,
  EMPTY,
  exhaustMap,
  filter,
  map,
  of,
  switchMap,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';
import { SessionExpiryDialogComponent } from '../../shared/components/session-expiry-dialog/session-expiry-dialog';
import { AuthService } from '../../shared/services/auth.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { AuthActions } from './auth.actions';
import { SessionActions } from './session.actions';

const isSessionExpired = (error: HttpErrorResponse): boolean =>
  error.status === 401 && error.error?.error?.code === 'SESSION_EXPIRED';

export const startSessionPollingOnLogin$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AuthActions.loginSuccess, AuthActions.registrationLoginSuccess),
      map(() => SessionActions.pollingStarted()),
    ),
  { functional: true },
);

export const pollSessionStatus$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(SessionActions.pollingStarted),
      switchMap(() =>
        timer(0, 15_000).pipe(
          map(() => SessionActions.statusRequested()),
          takeUntil(actions$.pipe(ofType(SessionActions.pollingStopped))),
        ),
      ),
    ),
  { functional: true },
);

export const requestSessionStatus$ = createEffect(
  (actions$ = inject(Actions), authService = inject(AuthService)) =>
    actions$.pipe(
      ofType(SessionActions.statusRequested),
      exhaustMap(() =>
        authService.sessionStatus().pipe(
          map((status) => SessionActions.statusLoaded(status)),
          catchError((error: HttpErrorResponse) =>
            isSessionExpired(error) ? of(SessionActions.sessionExpired()) : EMPTY,
          ),
        ),
      ),
    ),
  { functional: true },
);

export const startSessionCountdown$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(SessionActions.statusLoaded),
      filter(({ secondsRemaining }) => secondsRemaining <= 60),
      map(({ expiresAt }) => SessionActions.countdownStarted({ expiresAt })),
    ),
  { functional: true },
);

export const countdownSession$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(SessionActions.countdownStarted),
      switchMap(({ expiresAt }) =>
        timer(0, 1_000).pipe(
          map(() => Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1_000))),
          takeWhile((secondsRemaining) => secondsRemaining > 0, true),
          map((secondsRemaining) =>
            secondsRemaining === 0
              ? SessionActions.sessionExpired()
              : SessionActions.countdownTick({ secondsRemaining }),
          ),
          takeUntil(
            actions$.pipe(ofType(SessionActions.countdownStopped, SessionActions.refreshSucceeded)),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const refreshSession$ = createEffect(
  (actions$ = inject(Actions), authService = inject(AuthService)) =>
    actions$.pipe(
      ofType(SessionActions.refreshRequested),
      exhaustMap(() =>
        authService.refreshSession().pipe(
          map((response) => SessionActions.refreshSucceeded(response)),
          catchError((error: HttpErrorResponse) =>
            isSessionExpired(error)
              ? of(SessionActions.sessionExpired())
              : of(SessionActions.refreshFailed()),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const stopSessionPollingOnLogout$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AuthActions.logoutRequested, SessionActions.sessionExpired),
      map(() => SessionActions.pollingStopped()),
    ),
  { functional: true },
);

export const sessionExpired$ = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(SessionActions.sessionExpired),
      switchMap(() => [
        SessionActions.countdownStopped(),
        AuthActions.logoutRequested(),
        NotificationActions.show({
          variant: 'warning',
          titleKey: 'app.auth.sessionExpiredTitle',
          messageKey: 'app.auth.sessionExpiredMessage',
          preserveOnRoutes: ['/'],
        }),
        NavigationActions.navigate({ target: '/' }),
      ]),
    ),
  { functional: true },
);

export const openSessionExpiryDialog$ = createEffect(
  (actions$ = inject(Actions), dialog = inject(MatDialog)) =>
    actions$.pipe(
      ofType(SessionActions.statusLoaded),
      filter(({ secondsRemaining }) => secondsRemaining <= 60),
      map(() => {
        if (dialog.getDialogById('session-expiry') === undefined) {
          dialog.open(SessionExpiryDialogComponent, { id: 'session-expiry', disableClose: true });
        }
      }),
    ),
  { functional: true, dispatch: false },
);

export const closeSessionExpiryDialog$ = createEffect(
  (actions$ = inject(Actions), dialog = inject(MatDialog)) =>
    actions$.pipe(
      ofType(
        SessionActions.refreshSucceeded,
        SessionActions.sessionExpired,
        SessionActions.pollingStopped,
      ),
      map(() => dialog.getDialogById('session-expiry')?.close()),
    ),
  { functional: true, dispatch: false },
);

export const sessionEffects = {
  startSessionPollingOnLogin$,
  pollSessionStatus$,
  requestSessionStatus$,
  startSessionCountdown$,
  countdownSession$,
  refreshSession$,
  stopSessionPollingOnLogout$,
  sessionExpired$,
  openSessionExpiryDialog$,
  closeSessionExpiryDialog$,
};
