import { FulfillerOrdersActions } from './fulfiller-orders.actions';
import { fulfillerOrdersFeature } from './fulfiller-orders.feature';
import { initialState } from './fulfiller-orders.state';

describe('fulfillerOrdersFeature', () => {
  const order = {
    id: 'order-1',
    year: 2026,
    orderNumber: 12,
    currentText: 'Familie',
    items: [
      {
        id: 'item-1',
        itemNumber: 1,
        wishNumber: '12-1',
        category: 'gift' as const,
        currentDescription: 'Bauklötze',
        currentReason: null,
        fulfillmentStatus: 'available' as const,
        reservedAt: null,
        reservationExpiresAt: null,
      },
    ],
  };

  it('tracks filters and list loading states', () => {
    expect(
      fulfillerOrdersFeature.reducer(
        initialState,
        FulfillerOrdersActions.searchChanged({ search: 'Bau' }),
      ),
    ).toMatchObject({ search: 'Bau', loadStatus: 'loading' });
    expect(
      fulfillerOrdersFeature.reducer(
        initialState,
        FulfillerOrdersActions.loadSuccess({ orders: [order] }),
      ),
    ).toMatchObject({ orders: [order], loadStatus: 'loaded' });
  });

  it('patches only matching wish statuses without rebuilding the order list', () => {
    const state = { ...initialState, orders: [order] };
    const result = fulfillerOrdersFeature.reducer(
      state,
      FulfillerOrdersActions.wishStatusesUpdated({
        items: [
          {
            id: 'item-1',
            fulfillmentStatus: 'pending_confirmation',
            reservedAt: null,
            reservationExpiresAt: '2026-10-31T12:10:00Z',
          },
        ],
      }),
    );

    expect(result.orders[0].items[0]).toMatchObject({
      fulfillmentStatus: 'pending_confirmation',
      reservationExpiresAt: '2026-10-31T12:10:00Z',
    });
    expect(result.orders).not.toBe(state.orders);
  });
});
