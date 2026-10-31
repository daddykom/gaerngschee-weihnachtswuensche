import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAuthGroup } from '../../store/auth/auth.feature';

export const fulfillerGuard: CanActivateFn = () => {
  const group = inject(Store).selectSignal(selectAuthGroup)();
  return group === 'wunscherfueller' ? true : inject(Router).parseUrl('/erfuellen/anmelden');
};
