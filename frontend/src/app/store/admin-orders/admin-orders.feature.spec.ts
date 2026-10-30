import { AdminOrdersActions } from './admin-orders.actions';
import { adminOrdersFeature } from './admin-orders.feature';
import { initialState } from './admin-orders.state';

describe('adminOrdersFeature', () => {
  const order = { id: 'order-1', status: 'released', items: [] };

  it('tracks loading, loaded and failed list states', () => {
    expect(adminOrdersFeature.reducer(initialState, AdminOrdersActions.filtersChanged({ statuses: ['released'], categories: ['gift'] }))).toMatchObject({
      statuses: ['released'],
      categories: ['gift'],
      loadStatus: 'loading',
    });
    expect(adminOrdersFeature.reducer(initialState, AdminOrdersActions.loadSuccess({ orders: [order] as never }))).toMatchObject({
      orders: [order],
      loadStatus: 'loaded',
    });
    expect(adminOrdersFeature.reducer(initialState, AdminOrdersActions.loadFailure({ errorCode: 'FAILED' }))).toMatchObject({
      loadStatus: 'error',
      errorCode: 'FAILED',
    });
  });

  it('updates only the matching order for a draft change', () => {
    const other = { id: 'order-2', status: 'released', items: [] };
    const state = { ...initialState, orders: [order, other] as never };
    const changed = { ...order, status: 'changes_requested' };

    const result = adminOrdersFeature.reducer(state, AdminOrdersActions.draftChanged({ order: changed as never }));

    expect(result.orders).toEqual([changed, other]);
    expect(result.orders).not.toBe(state.orders);
  });

  it('tracks save success and failure without changing the draft on save start', () => {
    const state = { ...initialState, orders: [order] as never };
    expect(adminOrdersFeature.reducer(state, AdminOrdersActions.save({ order: order as never })).saveStatus).toBe('loading');
    expect(adminOrdersFeature.reducer(state, AdminOrdersActions.saveSuccess({ order: { ...order, status: 'definitive' } as never })).saveStatus).toBe('success');
    expect(adminOrdersFeature.reducer(state, AdminOrdersActions.saveFailure({ errorCode: 'FAILED' }))).toMatchObject({
      saveStatus: 'error',
      errorCode: 'FAILED',
    });
  });
});
