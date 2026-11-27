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

  it('stages removal only in the form and discards it when the order list is reloaded', () => {
    const item = {
      id: 'item-1',
      fulfillmentStatus: 'reserved',
      fulfillerEmail: 'giver@example.com',
      currentTitle: 'Persisted',
    };
    const form = {
      status: 'changes_requested',
      currentText: 'Unsaved family text',
      adminNotes: 'Unsaved feedback',
      adultsCount: 2,
      childrenCount: 1,
      items: [
        { ...item, currentTitle: 'Unsaved wish title', currentDescription: 'Unsaved description' },
      ],
    };
    const state = {
      ...initialState,
      orders: [{ ...order, items: [item] }] as never,
      activeOrderId: order.id,
      form: form as never,
    };
    const result = adminOrdersFeature.reducer(
      state,
      AdminOrdersActions.formChanged({
        orderId: order.id,
        changes: {
          items: form.items.map((current) => ({
            ...current,
            fulfillerRemoval: {
              fulfillerEmail: item.fulfillerEmail,
              fulfillmentStatus: item.fulfillmentStatus,
              reservedAt: null,
              reservationExpiresAt: null,
            },
          })) as never,
        },
      }),
    );
    expect(result.form).toMatchObject({
      currentText: 'Unsaved family text',
      adminNotes: 'Unsaved feedback',
      items: [
        {
          currentTitle: 'Unsaved wish title',
          currentDescription: 'Unsaved description',
          fulfillerEmail: 'giver@example.com',
          fulfillmentStatus: 'reserved',
          fulfillerRemoval: { fulfillerEmail: 'giver@example.com' },
        },
      ],
    });
    expect(result.orders[0].items[0]).toMatchObject({
      currentTitle: 'Persisted',
      fulfillerEmail: 'giver@example.com',
    });
    expect(adminOrdersFeature.reducer(result, AdminOrdersActions.load()).form).toBeNull();
    const failed = adminOrdersFeature.reducer(
      result,
      AdminOrdersActions.saveFailure({ errorCode: 'GIFT_ALREADY_RECEIVED' }),
    );
    expect(failed.form).toEqual(result.form);
  });

  it('keeps unsaved edits only in the active form and ignores updates for another order', () => {
    const form = {
      status: order.status,
      currentText: 'Edited family text',
      adminNotes: 'Family feedback',
      adultsCount: 1,
      childrenCount: 0,
      items: [],
    };
    const loaded = adminOrdersFeature.reducer(
      { ...initialState, orders: [order] },
      AdminOrdersActions.formLoaded({ orderId: order.id, form }),
    );
    const changed = adminOrdersFeature.reducer(
      loaded,
      AdminOrdersActions.formChanged({
        orderId: order.id,
        changes: { status: 'changes_requested' },
      }),
    );
    expect(changed.form).toEqual({ ...form, status: 'changes_requested' });
    expect(changed.orders).toBe(loaded.orders);
    expect(loaded.form).toBe(form);
    expect(
      adminOrdersFeature.reducer(
        changed,
        AdminOrdersActions.formChanged({
          orderId: 'other-order',
          changes: { adminNotes: 'Other feedback' },
        }),
      ),
    ).toBe(changed);
  });

  it('clears the active editing form on a fresh list load or successful save, but retains it on save failure', () => {
    const form = {
      status: order.status,
      currentText: 'Edited family text',
      adminNotes: 'Family feedback',
      adultsCount: 1,
      childrenCount: 0,
      items: [],
    };
    const state = { ...initialState, orders: [order], activeOrderId: order.id, form };
    for (const action of [
      AdminOrdersActions.load(),
      AdminOrdersActions.filtersChanged({ statuses: [], categories: [] }),
      AdminOrdersActions.saveSuccess({ order, mailSent: true }),
    ]) {
      const result = adminOrdersFeature.reducer(state, action);
      expect(result.activeOrderId).toBeNull();
      expect(result.form).toBeNull();
    }
    expect(
      adminOrdersFeature.reducer(state, AdminOrdersActions.saveFailure({ errorCode: 'FAILED' }))
        .form,
    ).toBe(form);
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

  it('also matches any giver email, tolerates missing emails and returns each order only once', () => {
    const orders = [
      {
        ...order,
        orderNumber: 12,
        items: [
          { id: 'wish-1', fulfillerEmail: null },
          { id: 'wish-2', fulfillerEmail: 'Giver@Example.ch' },
          { id: 'wish-3', fulfillerEmail: 'Giver@Example.ch' },
        ] as AdminOrder['items'],
      },
      {
        ...order,
        id: 'order-2',
        orderNumber: 123,
        items: [{ id: 'wish-4' }, { id: 'wish-5', fulfillerEmail: null }] as AdminOrder['items'],
      },
      { ...order, id: 'order-3', orderNumber: 124, requesterEmail: 'giver@example.ch', items: [] },
    ];
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: '  IVER@EXAMPLE  ',
        orderNumber: '',
      }),
    ).toEqual([orders[0], orders[2]]);
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: 'giver@',
        orderNumber: '12',
      }),
    ).toEqual([orders[0]]);
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: 'giver@',
        orderNumber: '123',
      }),
    ).toEqual([]);
    expect(
      adminOrdersFeature.selectFilteredOrders.projector(orders, {
        email: '',
        orderNumber: '',
      }),
    ).toEqual(orders);
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
