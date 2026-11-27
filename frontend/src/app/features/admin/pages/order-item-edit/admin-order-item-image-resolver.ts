import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { selectAdminItemImage } from '../../../../store/admin-orders/admin-orders.feature';

export const adminOrderItemImageResolver: ResolveFn<boolean> = (route) => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);
  const orderId = route.paramMap.get('orderId')!;
  const itemId = route.paramMap.get('itemId')!;
  progress.start();
  store.dispatch(AdminOrdersActions.imageEditorEntered({ orderId, itemId }));
  return store.select(selectAdminItemImage).pipe(
    filter(
      (request) =>
        (request.status === 'loaded' || request.status === 'error') &&
        request.orderId === orderId &&
        request.itemId === itemId,
    ),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
