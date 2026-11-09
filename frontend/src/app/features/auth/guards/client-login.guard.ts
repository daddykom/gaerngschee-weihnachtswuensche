import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../store/auth/auth.actions';

export const clientLoginGuard: CanMatchFn = () => {
  const router = inject(Router);
  const store = inject(Store);
  const url = router.getCurrentNavigation()?.initialUrl ?? router.parseUrl(router.url);
  const token = url.queryParams['token'];

  if (typeof token !== 'string' || token === '') {
    store.dispatch(
      AuthActions.registrationLoginFailure({ errorCode: 'INVALID_REGISTRATION_TOKEN' }),
    );
    return router.parseUrl('/start');
  }

  return true;
};
