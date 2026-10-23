import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAuthGroup } from '../../store/auth/auth.feature';
import { UserGroup } from '../models/frontend-config.model';

export const groupGuard =
  (allowedGroups: UserGroup[]): CanActivateFn =>
  () => {
    const store = inject(Store);
    const router = inject(Router);
    const group = store.selectSignal(selectAuthGroup)();

    return group !== null && allowedGroups.includes(group) ? true : router.parseUrl('/not-found');
  };
