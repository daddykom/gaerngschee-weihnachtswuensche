import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, forkJoin, from, map, mergeMap, of } from 'rxjs';
import { FrontendConfigService } from '../../shared/services/frontend-config.service';
import { NotificationActions } from '../notification/notification.actions';
import { FrontendConfigActions } from './frontend-config.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const loadFrontendConfigEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FrontendConfigService)) =>
    actions$.pipe(
      ofType(FrontendConfigActions.load),
      exhaustMap(() =>
        service.list().pipe(
          map((configs) => FrontendConfigActions.loadSuccess({ configs })),
          catchError((error: HttpErrorResponse) =>
            of(FrontendConfigActions.loadFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadPublicFrontendConfigEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FrontendConfigService)) =>
    actions$.pipe(
      ofType(FrontendConfigActions.loadPublic),
      exhaustMap(() =>
        service.listPublic().pipe(
          map((configs) => FrontendConfigActions.loadPublicSuccess({ configs })),
          catchError((error: HttpErrorResponse) =>
            of(FrontendConfigActions.loadPublicFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const saveFrontendConfigEffect = createEffect(
  (actions$ = inject(Actions), service = inject(FrontendConfigService)) =>
    actions$.pipe(
      ofType(FrontendConfigActions.save),
      exhaustMap(({ configs }) =>
        forkJoin(configs.map(({ id, value }) => service.update(id, value))).pipe(
          mergeMap((updated) =>
            from([
              FrontendConfigActions.saveSuccess({ configs: updated }),
              FrontendConfigActions.loadPublic(),
            ]),
          ),
          catchError((error: HttpErrorResponse) =>
            of(FrontendConfigActions.saveFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const frontendConfigNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        FrontendConfigActions.saveSuccess,
        FrontendConfigActions.saveFailure,
        FrontendConfigActions.loadPublicFailure,
      ),
      map((action) =>
        action.type === FrontendConfigActions.saveSuccess.type
          ? NotificationActions.show({
              variant: 'success',
              titleKey: 'app.admin.configuration.successTitle',
              messageKey: 'app.admin.configuration.saved',
              preserveOnRoutes: ['/admin/configuration'],
            })
          : action.type === FrontendConfigActions.loadPublicFailure.type
            ? NotificationActions.show({
                variant: 'error',
                titleKey: 'app.publicConfiguration.errorTitle',
                messageKey: 'app.publicConfiguration.error',
              })
            : NotificationActions.show({
                variant: 'error',
                titleKey: 'app.admin.configuration.errorTitle',
                messageKey: `app.admin.configuration.errors.${action.errorCode}`,
                preserveOnRoutes: ['/admin/configuration'],
              }),
      ),
    ),
  { functional: true },
);

export const frontendConfigEffects = {
  loadFrontendConfigEffect,
  loadPublicFrontendConfigEffect,
  saveFrontendConfigEffect,
  frontendConfigNotificationEffect,
};
