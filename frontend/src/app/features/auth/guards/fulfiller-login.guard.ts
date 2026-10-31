import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthActions } from '../../../store/auth/auth.actions';

export const fulfillerLoginGuard: CanMatchFn = () => {
  const router = inject(Router);
  const store = inject(Store);
  const url = router.getCurrentNavigation()?.initialUrl ?? router.parseUrl(router.url);
  const token = url.queryParams['token'];
  if (typeof token !== 'string' || token === '') return router.parseUrl('/erfuellen/anmelden');

  return inject(AuthService)
    .fulfillerRegistrationLogin(token)
    .pipe(
      map((response) => {
        store.dispatch(
          AuthActions.loginSuccess({
            userId: response.user.id,
            email: response.user.email,
            group: response.group,
            requiredPasswordReset: false,
          }),
        );
        return router.parseUrl('/erfuellen');
      }),
      catchError((error: HttpErrorResponse) => {
        store.dispatch(
          AuthActions.loginFailure({
            errorCode:
              typeof error.error?.error?.code === 'string'
                ? error.error.error.code
                : 'REGISTRATION_LOGIN_FAILED',
          }),
        );
        return of(router.parseUrl('/erfuellen/anmelden'));
      }),
    );
};
