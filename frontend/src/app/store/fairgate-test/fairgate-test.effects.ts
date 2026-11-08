import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { FairgateTestService } from '../../shared/services/fairgate-test.service';
import { NotificationActions } from '../notification/notification.actions';
import { FairgateTestActions } from './fairgate-test.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const fairgateTestEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FairgateTestService)) =>
    actions$.pipe(
      ofType(FairgateTestActions.test),
      exhaustMap(() =>
        service.test().pipe(
          map((result) => FairgateTestActions.testSuccess({ result })),
          catchError((error: HttpErrorResponse) =>
            of(FairgateTestActions.testFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const showFairgateTestFailureNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(FairgateTestActions.testFailure),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.fairgateTest.errorTitle',
          messageKey: `app.admin.fairgateTest.errors.${errorCode}`,
          preserveOnRoutes: ['/admin/fairgate-test'],
        }),
      ),
    ),
  { functional: true },
);

export const fairgateTestEffects = {
  fairgateTestEffect,
  showFairgateTestFailureNotificationEffect,
};
