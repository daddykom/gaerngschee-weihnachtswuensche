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

  it('updates only the reserved wish', () => {
    const state = { ...initialState, orders: [order] };
    const result = fulfillerOrdersFeature.reducer(
      state,
      FulfillerOrdersActions.reserveSuccess({
        orderId: 'order-1',
        itemId: 'item-1',
        reservedAt: '2026-10-31T12:00:00Z',
      }),
    );

    expect(result.orders[0].items[0]).toMatchObject({
      fulfillmentStatus: 'reserved',
      reservedAt: '2026-10-31T12:00:00Z',
    });
    expect(result.orders).not.toBe(state.orders);
  });
});
