import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { AdminUsersService } from '../../shared/services/admin-users.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { AdminUsersActions } from './admin-users.actions';

const errorCode = (error: HttpErrorResponse): string =>
  typeof error.error?.error?.code === 'string' ? error.error.error.code : 'REQUEST_FAILED';

export const loadAdminUsersEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.load),
      exhaustMap(() =>
        service.list().pipe(
          map((users) => AdminUsersActions.loadSuccess({ users })),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.loadFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const createAdminUserEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.create),
      exhaustMap(({ email, group }) =>
        service.create(email, group).pipe(
          map(({ user, emailSentTo }) =>
            AdminUsersActions.createSuccess({
              user,
              emailSentTo: emailSentTo ?? user.email,
            }),
          ),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.createFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadAdminUserEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.loadUser),
      exhaustMap(({ userId }) =>
        service.get(userId).pipe(
          map(({ user }) => AdminUsersActions.loadUserSuccess({ user })),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.loadUserFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadAdminUserProfileEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.loadProfile),
      exhaustMap(() =>
        service.getProfile().pipe(
          map(({ user }) => AdminUsersActions.loadUserSuccess({ user })),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.loadUserFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const updateAdminUserEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.update),
      exhaustMap(({ userId, changes }) =>
        service.update(userId, changes).pipe(
          map(({ user, emailSentTo }) =>
            AdminUsersActions.updateSuccess({ user, emailSentTo: emailSentTo ?? null }),
          ),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.updateFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteAdminUserEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.delete),
      exhaustMap(({ userId }) =>
        service.delete(userId).pipe(
          map(() => AdminUsersActions.deleteSuccess({ userId })),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.deleteFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const updateAdminUserProfileEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.updateProfile),
      exhaustMap(({ changes }) =>
        service.updateProfile(changes).pipe(
          map(({ user, emailSentTo }) =>
            AdminUsersActions.updateProfileSuccess({ user, emailSentTo: emailSentTo ?? null }),
          ),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.updateProfileFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const sendPasswordResetEffect = createEffect(
  (actions$ = inject(Actions), service = inject(AdminUsersService)) =>
    actions$.pipe(
      ofType(AdminUsersActions.sendPasswordReset),
      exhaustMap(({ userId }) =>
        service.sendPasswordReset(userId).pipe(
          map(({ emailSentTo }) => AdminUsersActions.sendPasswordResetSuccess({ emailSentTo })),
          catchError((error: HttpErrorResponse) =>
            of(AdminUsersActions.sendPasswordResetFailure({ errorCode: errorCode(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const navigateBackAfterUserMutationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        AdminUsersActions.createSuccess,
        AdminUsersActions.updateSuccess,
        AdminUsersActions.updateProfileSuccess,
      ),
      map(() => NavigationActions.navigate({ target: 'back' })),
    ),
  { functional: true },
);

export const adminUsersNotificationEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(
        AdminUsersActions.createSuccess,
        AdminUsersActions.updateSuccess,
        AdminUsersActions.updateProfileSuccess,
        AdminUsersActions.deleteSuccess,
        AdminUsersActions.sendPasswordResetSuccess,
        AdminUsersActions.createFailure,
        AdminUsersActions.updateFailure,
        AdminUsersActions.updateProfileFailure,
        AdminUsersActions.deleteFailure,
        AdminUsersActions.sendPasswordResetFailure,
      ),
      map((action) => {
        if (action.type === AdminUsersActions.createSuccess.type) {
          return NotificationActions.show({
            variant: 'success',
            titleKey: 'app.admin.users.successTitle',
            messageKey: 'app.admin.users.createdWithEmail',
            params: { recipient: action.emailSentTo },
            preserveOnRoutes: ['/admin/users'],
          });
        }

        if (
          action.type === AdminUsersActions.updateSuccess.type ||
          action.type === AdminUsersActions.updateProfileSuccess.type
        ) {
          return NotificationActions.show({
            variant: 'success',
            titleKey: 'app.admin.users.successTitle',
            messageKey: action.emailSentTo
              ? 'app.admin.users.updatedWithEmail'
              : 'app.admin.users.updated',
            params: action.emailSentTo ? { recipient: action.emailSentTo } : {},
            preserveOnRoutes:
              action.type === AdminUsersActions.updateProfileSuccess.type
                ? ['/user/profile']
                : ['/admin/users'],
          });
        }

        if (action.type === AdminUsersActions.deleteSuccess.type) {
          return NotificationActions.show({
            variant: 'success',
            titleKey: 'app.admin.users.successTitle',
            messageKey: 'app.admin.users.deleted',
            preserveOnRoutes: ['/admin/users'],
          });
        }

        if (action.type === AdminUsersActions.sendPasswordResetSuccess.type) {
          return NotificationActions.show({
            variant: 'success',
            titleKey: 'app.admin.users.successTitle',
            messageKey: 'app.admin.users.passwordResetSent',
            params: { recipient: action.emailSentTo },
            preserveOnRoutes: ['/admin/users'],
          });
        }

        return NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.users.errorTitle',
          messageKey: `app.admin.users.errors.${action.errorCode}`,
          preserveOnRoutes: ['/admin/users'],
        });
      }),
    ),
  { functional: true },
);

export const adminUsersEffects = {
  loadAdminUsersEffect,
  loadAdminUserEffect,
  loadAdminUserProfileEffect,
  createAdminUserEffect,
  updateAdminUserEffect,
  updateAdminUserProfileEffect,
  deleteAdminUserEffect,
  sendPasswordResetEffect,
  navigateBackAfterUserMutationEffect,
  adminUsersNotificationEffect,
};
