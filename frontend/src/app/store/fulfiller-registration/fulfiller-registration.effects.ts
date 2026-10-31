import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, exhaustMap, map, of } from 'rxjs';
import { FulfillerRegistrationService } from '../../shared/services/fulfiller-registration.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { FulfillerRegistrationActions } from './fulfiller-registration.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const submitFulfillerRegistrationEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FulfillerRegistrationService)) =>
    actions$.pipe(
      ofType(FulfillerRegistrationActions.submit),
      exhaustMap(({ email, privacyAccepted, language }) =>
        service.requestLink(email, language, privacyAccepted).pipe(
          map(({ sent }) => FulfillerRegistrationActions.submitSuccess({ sent })),
          catchError((error: HttpErrorResponse) =>
            of(FulfillerRegistrationActions.submitFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const showFulfillerRegistrationSuccessEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(FulfillerRegistrationActions.submitSuccess),
      concatMap(() => [
        NotificationActions.show({
          variant: 'success',
          titleKey: 'app.fulfillerRegistration.emailSentTitle',
          messageKey: 'app.fulfillerRegistration.emailSentMessage',
          preserveOnRoutes: ['/erfuellen/anmelden/success'],
        }),
        NavigationActions.navigate({ target: '/erfuellen/anmelden/success' }),
      ]),
    ),
  { functional: true },
);

export const showFulfillerRegistrationFailureEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(FulfillerRegistrationActions.submitFailure),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.fulfillerRegistration.errorTitle',
          messageKey: `app.fulfillerRegistration.errors.${errorCode}`,
          preserveOnRoutes: ['/erfuellen/anmelden'],
        }),
      ),
    ),
  { functional: true },
);

export const fulfillerRegistrationEffects = {
  submitFulfillerRegistrationEffect,
  showFulfillerRegistrationSuccessEffect,
  showFulfillerRegistrationFailureEffect,
};
