import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { FulfillerOrdersService } from '../../shared/services/fulfiller-orders.service';
import { FulfillerOrdersActions as actions } from './fulfiller-orders.actions';
import { fulfillerOrdersEffects } from './fulfiller-orders.effects';
import { initialState } from './fulfiller-orders.state';

describe('released public wishes', () => {
  it('reloads missing available wishes with the current filters but ignores known wishes', async () => {
    const actions$ = new Subject<Action>();
    const list = vi.fn(() => of({ orders: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({
          initialState: { fulfillerOrders: { ...initialState, search: 'coat', category: 'gift' } },
        }),
        { provide: FulfillerOrdersService, useValue: { list } },
      ],
    });
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() => fulfillerOrdersEffects.reloadReleasedWishesEffect()),
    );
    const item = {
      id: 'released',
      fulfillmentStatus: 'available' as const,
      reservedAt: null,
      reservationExpiresAt: null,
    };
    actions$.next(
      actions.wishStatusesUpdated({ items: [{ ...item, fulfillmentStatus: 'reserved' }] }),
    );
    expect(list).not.toHaveBeenCalled();
    actions$.next(actions.wishStatusesUpdated({ items: [item] }));
    await expect(result).resolves.toEqual(actions.loadSuccess({ orders: [] }));
    expect(list).toHaveBeenCalledWith('coat', 'gift');
    const subscription = TestBed.runInInjectionContext(() =>
      fulfillerOrdersEffects.reloadReleasedWishesEffect(),
    ).subscribe();
    TestBed.inject(MockStore).setState({
      fulfillerOrders: { ...initialState, orders: [{ id: 'order-1', items: [item] }] },
    });
    actions$.next(actions.wishStatusesUpdated({ items: [item] }));
    expect(list).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });
});
