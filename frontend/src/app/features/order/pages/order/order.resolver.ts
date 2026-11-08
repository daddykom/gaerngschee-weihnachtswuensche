import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { OrderActions } from '../../../../store/order/order.actions';
import { selectOrderStatus } from '../../../../store/order/order.feature';

export const orderResolver: ResolveFn<boolean> = () => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);

  progress.start();
  store.dispatch(OrderActions.load());

  return store.select(selectOrderStatus).pipe(
    filter((status) => status === 'loaded' || status === 'error'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
