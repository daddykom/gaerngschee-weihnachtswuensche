import { AdminOrder } from '../../shared/models/admin-order.model';
import { AdminOrdersActions } from './admin-orders.actions';
import { adminOrdersFeature } from './admin-orders.feature';
import { initialState } from './admin-orders.state';

describe('adminOrdersFeature', () => {
  const order: AdminOrder = {
    id: 'order-1',
    userId: 'user-1',
    requesterEmail: 'person@example.com',
    year: 2026,
    status: 'released',
    adultsCount: 1,
    childrenCount: 0,
    originalText: null,
    currentText: null,
    adminNotes: null,
    fairgateStatus: 'valid',
    fairgateAdultsCount: 1,
    fairgateChildrenCount: 0,
    processingYear: 2026,
    releasedAt: null,
    definitiveAt: null,
    confirmationEmailSentAt: null,
    fairgateReminderEmailSentAt: null,
    items: [],
    createdAt: null,
    updatedAt: null,
  };

  it('tracks loading, loaded and failed list states', () => {
    expect(
      adminOrdersFeature.reducer(
        initialState,
        AdminOrdersActions.filtersChanged({ statuses: ['released'], categories: ['gift'] }),
      ),
    ).toMatchObject({
      statuses: ['released'],
      categories: ['gift'],
      loadStatus: 'loading',
    });
    expect(
      adminOrdersFeature.reducer(
        initialState,
        AdminOrdersActions.loadSuccess({ orders: [order] as never }),
      ),
    ).toMatchObject({
      orders: [order],
      loadStatus: 'loaded',
    });
    expect(
      adminOrdersFeature.reducer(
        initialState,
        AdminOrdersActions.loadFailure({ errorCode: 'FAILED' }),
      ),
    ).toMatchObject({
      loadStatus: 'error',
      errorCode: 'FAILED',
    });
  });

  it('updates only the matching order for a draft change', () => {
    const other = { id: 'order-2', status: 'released', items: [] };
    const state = { ...initialState, orders: [order, other] as never };
    const changed = { ...order, status: 'changes_requested' };

    const result = adminOrdersFeature.reducer(
      state,
      AdminOrdersActions.draftChanged({ order: changed as never }),
    );

    expect(result.orders).toEqual([changed, other]);
    expect(result.orders).not.toBe(state.orders);
  });

  it('keeps the search form when list filters and results change', () => {
    const state = adminOrdersFeature.reducer(
      initialState,
      AdminOrdersActions.searchFormChanged({ changes: { email: 'Example' } }),
    );
    expect(state.searchForm).toEqual({ email: 'Example', orderNumber: '' });
    expect(state.loadStatus).toBe('initial');
    const filtered = adminOrdersFeature.reducer(
      state,
      AdminOrdersActions.filtersChanged({ statuses: ['definitive'], categories: ['gift'] }),
    );
    const loaded = adminOrdersFeature.reducer(
      filtered,
      AdminOrdersActions.loadSuccess({ orders: [] }),
    );
    expect(loaded.searchForm).toEqual({ email: 'Example', orderNumber: '' });
    expect(initialState.searchForm).toEqual({ email: '', orderNumber: '' });
  });

  it('matches email substrings without case sensitivity and ignores surrounding whitespace', () => {
    const orders = [
      { ...order, requesterEmail: 'Anna@Example.ch' },
      { ...order, id: 'order-2', requesterEmail: 'other@example.org' },
    ] as AdminOrder[];
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: ' NA@EXAMPLE ',
        orderNumber: '',
      }),
    ).toEqual([orders[0]]);
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, { email: '', orderNumber: '' }),
    ).toEqual(orders);
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: 'missing',
        orderNumber: '',
      }),
    ).toEqual([]);
  });

  it('matches the exact order number and combines it with the email filter', () => {
    const orders = [
      { ...order, orderNumber: 12 },
      { ...order, id: 'order-2', orderNumber: 123 },
      { ...order, id: 'order-3', orderNumber: null },
    ];
    for (const number of ['12', ' 12 ', '012']) {
      expect(
        adminOrdersFeature.selectFilteredOrders.projector(orders, {
          email: '',
          orderNumber: number,
        }),
      ).toEqual([orders[0]]);
    }
    for (const number of ['1', '0', '-12', '12-1', 'invalid', '12.0']) {
      expect(
        adminOrdersFeature.selectFilteredOrders.projector(orders, {
          email: '',
          orderNumber: number,
        }),
      ).toEqual([]);
    }
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: 'missing',
        orderNumber: '12',
      }),
    ).toEqual([]);
  });

  it('preserves the order number when only the email or list filters change', () => {
    const state = adminOrdersFeature.reducer(
      initialState,
      AdminOrdersActions.searchFormChanged({ changes: { orderNumber: '12' } }),
    );
    const changed = adminOrdersFeature.reducer(
      state,
      AdminOrdersActions.searchFormChanged({ changes: { email: 'Example' } }),
    );
    const filtered = adminOrdersFeature.reducer(
      changed,
      AdminOrdersActions.filtersChanged({ statuses: [], categories: [] }),
    );
    expect(filtered.searchForm).toEqual({ email: 'Example', orderNumber: '12' });
    expect(initialState.searchForm).toEqual({ email: '', orderNumber: '' });
  });

  it('tracks save success and failure without changing the draft on save start', () => {
    const state = { ...initialState, orders: [order] as never };
    expect(
      adminOrdersFeature.reducer(state, AdminOrdersActions.save({ order: order as never }))
        .saveStatus,
    ).toBe('loading');
    expect(
      adminOrdersFeature.reducer(
        state,
        AdminOrdersActions.saveSuccess({
          order: { ...order, status: 'definitive' } as never,
          mailSent: false,
        }),
      ).saveStatus,
    ).toBe('success');
    expect(
      adminOrdersFeature.reducer(state, AdminOrdersActions.saveFailure({ errorCode: 'FAILED' })),
    ).toMatchObject({
      saveStatus: 'error',
      errorCode: 'FAILED',
    });
  });
});
