import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, RouterStateSnapshot } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import { AdminItemImageRequest } from '../../../../store/admin-orders/admin-orders.state';
import { adminOrderItemImageResolver } from './admin-order-item-image-resolver';

describe('adminOrderItemImageResolver', () => {
  for (const status of ['loaded', 'error', 'cancelled'] as const) {
    it(`waits for this wish and restores the progress cursor after ${status}`, () => {
      const state = new Subject<AdminItemImageRequest>();
      const dispatch = vi.fn();
      const progress = { start: vi.fn(), stop: vi.fn() };
      TestBed.configureTestingModule({
        providers: [
          { provide: Store, useValue: { dispatch, select: () => state } },
          { provide: NavigationProgressService, useValue: progress },
        ],
      });
      const identity = { orderId: 'order-1', itemId: 'item-1' };
      const result = TestBed.runInInjectionContext(() =>
        adminOrderItemImageResolver(
          {
            paramMap: convertToParamMap(identity),
          } as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
        ),
      ) as Observable<boolean>;
      const next = vi.fn();
      const subscription = result.subscribe(next);
      expect(dispatch).toHaveBeenCalledWith(AdminOrdersActions.imageEditorEntered(identity));
      expect(progress.start).toHaveBeenCalledOnce();
      state.next({
        status: 'loaded',
        orderId: 'other',
        itemId: 'other',
        data: { revision: 0, image: null },
        blob: null,
      });
      state.next({ status: 'loading', ...identity });
      expect(next).not.toHaveBeenCalled();
      if (status === 'loaded')
        state.next({ status, ...identity, data: { revision: 0, image: null }, blob: null });
      if (status === 'error') state.next({ status, ...identity, errorCode: 'FAILED' });
      subscription.unsubscribe();
      expect(progress.stop).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledTimes(status === 'cancelled' ? 0 : 1);
    });
  }
});
