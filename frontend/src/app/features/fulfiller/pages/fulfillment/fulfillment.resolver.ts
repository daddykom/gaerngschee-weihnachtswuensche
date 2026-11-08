import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { FulfillerOrdersActions } from '../../../../store/fulfiller-orders/fulfiller-orders.actions';
import { selectFulfillerOrdersLoadStatus } from '../../../../store/fulfiller-orders/fulfiller-orders.feature';

export const fulfillmentResolver: ResolveFn<boolean> = () => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);

  progress.start();
  store.dispatch(FulfillerOrdersActions.load());

  return store.select(selectFulfillerOrdersLoadStatus).pipe(
    filter((status) => status === 'loaded' || status === 'error'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
