import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthActions } from '../../../store/auth/auth.actions';

export const clientLoginGuard: CanMatchFn = () => {
  const router = inject(Router);
  const store = inject(Store);
  const url = router.getCurrentNavigation()?.initialUrl ?? router.parseUrl(router.url);
  const token = url.queryParams['token'];

  if (typeof token !== 'string' || token === '') {
    store.dispatch(AuthActions.registrationLoginFailure({ errorCode: 'INVALID_REGISTRATION_TOKEN' }));
    return router.parseUrl('/start');
  }

  return inject(AuthService).registrationLogin(token).pipe(
    map((response) => {
      store.dispatch(AuthActions.registrationLoginSuccess({
        userId: response.user.id,
        email: response.user.email,
         group: response.group,
         fairgateStatus: response.fairgateStatus,
         fairgateUserExists: response.fairgateUserExists,
        childrenCount: response.childrenCount,
        adultsCount: response.adultsCount,
        salutation: response.salutation,
      }));
      return router.parseUrl('/bestellung');
    }),
    catchError((error: HttpErrorResponse) => {
      store.dispatch(AuthActions.registrationLoginFailure({
        errorCode: typeof error.error?.error?.code === 'string'
          ? error.error.error.code
          : 'REGISTRATION_LOGIN_FAILED',
      }));
      return of(router.parseUrl('/start'));
    }),
  );
};
