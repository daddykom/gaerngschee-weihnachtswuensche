import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { selectAdminOrdersLoadStatus } from '../../../../store/admin-orders/admin-orders.feature';

export const adminOrdersResolver: ResolveFn<boolean> = () => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);

  progress.start();
  store.dispatch(AdminOrdersActions.load());

  return store.select(selectAdminOrdersLoadStatus).pipe(
    filter((status) => status === 'loaded' || status === 'error'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
