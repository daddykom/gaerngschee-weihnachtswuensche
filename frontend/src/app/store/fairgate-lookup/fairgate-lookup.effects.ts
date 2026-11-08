import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, filter, map, of, tap } from 'rxjs';
import { FairgateLookupService } from '../../shared/services/fairgate-lookup.service';
import { NotificationActions } from '../notification/notification.actions';
import { FairgateLookupActions } from './fairgate-lookup.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const fairgateLookupEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FairgateLookupService)) =>
    actions$.pipe(
      ofType(FairgateLookupActions.lookup),
      exhaustMap(({ email, membership }) =>
        service.lookup(email, membership).pipe(
          map((result) => FairgateLookupActions.lookupSuccess({ result })),
          catchError((error: HttpErrorResponse) =>
            of(FairgateLookupActions.lookupFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const showFairgateLookupFailureNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(FairgateLookupActions.lookupFailure),
      filter(({ errorCode }) => errorCode !== 'NOT_FOUND'),
      map(({ errorCode }) =>
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.fairgateLookup.errorTitle',
          messageKey: `app.admin.fairgateLookup.errors.${errorCode}`,
          preserveOnRoutes: ['/admin/fairgate-lookup'],
        }),
      ),
    ),
  { functional: true },
);

export const redirectMissingFairgateLookupEffect = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(FairgateLookupActions.lookupFailure),
      filter(({ errorCode }) => errorCode === 'NOT_FOUND'),
      tap(() => void router.navigateByUrl('/not-found')),
    ),
  { dispatch: false, functional: true },
);

export const fairgateLookupEffects = {
  fairgateLookupEffect,
  showFairgateLookupFailureNotificationEffect,
  redirectMissingFairgateLookupEffect,
};
