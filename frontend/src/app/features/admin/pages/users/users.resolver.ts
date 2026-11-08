import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminUsersActions } from '../../../../store/admin-users/admin-users.actions';
import { selectAdminUsersLoadStatus } from '../../../../store/admin-users/admin-users.feature';

export const usersResolver: ResolveFn<boolean> = () => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);

  progress.start();
  store.dispatch(AdminUsersActions.load());

  return store.select(selectAdminUsersLoadStatus).pipe(
    filter((status) => status === 'loaded' || status === 'error'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
