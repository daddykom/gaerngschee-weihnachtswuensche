import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { EmailTestService } from '../../shared/services/email-test.service';
import { NotificationActions } from '../notification/notification.actions';
import { EmailTestActions } from './email-test.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const loadEmailTestEffect = createEffect(
  (actions$ = inject(Actions), service = inject(EmailTestService)) =>
    actions$.pipe(
      ofType(EmailTestActions.load),
      exhaustMap(() =>
        service.listTemplates().pipe(
          map(({ templates }) => EmailTestActions.loadSuccess({ templates })),
          catchError((error: HttpErrorResponse) =>
            of(EmailTestActions.loadFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const sendEmailTestEffect = createEffect(
  (actions$ = inject(Actions), service = inject(EmailTestService)) =>
    actions$.pipe(
      ofType(EmailTestActions.send),
      exhaustMap(({ form }) =>
        service.send(form).pipe(
          map(({ emailSentTo }) => EmailTestActions.sendSuccess({ emailSentTo })),
          catchError((error: HttpErrorResponse) =>
            of(EmailTestActions.sendFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const showEmailTestSuccessNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(EmailTestActions.sendSuccess),
      map(({ emailSentTo }) =>
        NotificationActions.show({
          variant: 'success',
          titleKey: 'app.admin.emailTest.successTitle',
          messageKey: 'app.admin.emailTest.sent',
          params: { email: emailSentTo },
          preserveOnRoutes: ['/admin/email-test'],
        }),
      ),
    ),
  { functional: true },
);

export const showEmailTestFailureNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(EmailTestActions.loadFailure, EmailTestActions.sendFailure),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.emailTest.errorTitle',
          messageKey: `app.admin.emailTest.errors.${errorCode}`,
          preserveOnRoutes: ['/admin/email-test'],
        }),
      ),
    ),
  { functional: true },
);

export const emailTestEffects = {
  loadEmailTestEffect,
  sendEmailTestEffect,
  showEmailTestSuccessNotificationEffect,
  showEmailTestFailureNotificationEffect,
};
