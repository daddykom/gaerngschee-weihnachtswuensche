import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, exhaustMap, map, of } from 'rxjs';
import { AnmeldungService } from '../../shared/services/anmeldung.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { StartActions } from './start.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

const translatedErrorKey = (code: string): string =>
  [
    'PRIVACY_CONSENT_REQUIRED',
    'CAMPAIGN_NOT_STARTED',
    'CAMPAIGN_ENDED',
    'CAMPAIGN_CAPACITY_REACHED',
    'REQUEST_FAILED',
  ].includes(code)
    ? `app.anmeldung.errors.${code}`
    : 'app.anmeldung.sendError';

export const submitStartEffect = createEffect(
  (actions$ = inject(Actions), anmeldungService = inject(AnmeldungService)) =>
    actions$.pipe(
      ofType(StartActions.submit),
      exhaustMap(({ email, language }) =>
        anmeldungService.requestInformation(email, language).pipe(
          map(({ sent }) => StartActions.submitSuccess({ sent })),
          catchError((error: HttpErrorResponse) =>
            of(StartActions.submitFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const showStartSuccessAndNavigateEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(StartActions.submitSuccess),
      concatMap(() => [
        NotificationActions.show({
          variant: 'success',
          titleKey: 'app.anmeldung.emailSentTitle',
          messageKey: 'app.anmeldung.emailSentMessage',
          preserveOnRoutes: ['/start/success'],
        }),
        NavigationActions.navigate({ target: '/start/success' }),
      ]),
    ),
  { functional: true },
);

export const showStartFailureNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(StartActions.submitFailure),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.anmeldung.errorTitle',
          messageKey: translatedErrorKey(errorCode),
          preserveOnRoutes: ['/start'],
        }),
      ),
    ),
  { functional: true },
);

export const startEffects = {
  submitStartEffect,
  showStartSuccessAndNavigateEffect,
  showStartFailureNotificationEffect,
};
