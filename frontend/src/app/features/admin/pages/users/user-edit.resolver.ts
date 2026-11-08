import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminUsersActions } from '../../../../store/admin-users/admin-users.actions';
import { selectAdminUsersDetailStatus } from '../../../../store/admin-users/admin-users.feature';

export const userEditResolver: ResolveFn<boolean> = (route) => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);
  const isProfile = route.routeConfig?.path === 'user/profile';
  const userId = route.paramMap.get('userId');

  progress.start();
  if (isProfile) {
    store.dispatch(AdminUsersActions.loadProfile());
  } else if (userId !== null) {
    store.dispatch(AdminUsersActions.loadUser({ userId }));
  } else {
    progress.stop();
    return true;
  }

  return store.select(selectAdminUsersDetailStatus).pipe(
    filter((status) => status === 'loaded' || status === 'error'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
