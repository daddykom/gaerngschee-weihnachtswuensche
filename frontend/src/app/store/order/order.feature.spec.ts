import { Order } from '../../shared/models/order.model';
import { OrderActions } from './order.actions';
import { orderFeature } from './order.feature';
import { initialState } from './order.state';

describe('orderFeature', () => {
  it.each([
    { orderNotes: 'Please review the family text', itemNotes: 'Please review the wish text' },
    { orderNotes: null, itemNotes: null },
  ])('retains requester feedback outside the editable form: %j', ({ orderNotes, itemNotes }) => {
    const order: Order = {
      id: 'order-1',
      userId: 'user-1',
      year: 2026,
      status: 'changes_requested',
      adultsCount: 1,
      childrenCount: 0,
      originalText: 'Original family text',
      currentText: 'Edited family text',
      adminNotes: orderNotes,
      fairgateStatus: 'valid',
      confirmationEmailSentAt: null,
      fairgateReminderEmailSentAt: null,
      createdAt: null,
      updatedAt: null,
      items: [
        {
          id: 'item-1',
          orderId: 'order-1',
          category: 'gift',
          personType: 'adult',
          personIndex: 1,
          originalTitle: 'Original wish title',
          currentTitle: 'Edited wish title',
          originalDescription: 'Original wish text',
          currentDescription: 'Edited wish text',
          giftLink: null,
          originalReason: null,
          currentReason: null,
          personalMessage: null,
          adminNotes: itemNotes,
          status: 'rejected',
          fulfillerEmail: null,
          reservedAt: null,
          dueAt: null,
          receivedAt: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
    };
    const loaded = orderFeature.reducer(
      initialState,
      OrderActions.loadSuccess({
        overview: {
          order,
          year: 2026,
          fairgateStatus: 'valid',
          fairgateUserExists: true,
          adultsCount: 1,
          childrenCount: 0,
          canEdit: true,
        },
      }),
    );

    const selected = orderFeature.selectOrder({ order: loaded });
    expect(selected?.adminNotes).toBe(orderNotes);
    expect(selected?.items[0].adminNotes).toBe(itemNotes);
    expect(loaded.form.text).toBe('Edited family text');
    expect(loaded.form.items[0].description).toBe('Edited wish text');
    expect(loaded.form).not.toHaveProperty('adminNotes');
    expect(loaded.form.items[0]).not.toHaveProperty('adminNotes');

    const changedOrder = orderFeature.reducer(
      loaded,
      OrderActions.formChanged({ changes: { text: 'Requester family text' } }),
    );
    const changedItem = orderFeature.reducer(
      changedOrder,
      OrderActions.itemFormChanged({
        itemId: 'item-1',
        changes: { description: 'Requester wish text' },
      }),
    );
    expect(orderFeature.selectOrder({ order: changedItem })).toBe(order);

    const saved = orderFeature.reducer(
      changedItem,
      OrderActions.saveSuccess({
        result: { order: { ...order, status: 'draft' }, status: 'draft', fairgateUserExists: true },
      }),
    );
    expect(saved.order?.adminNotes).toBe(orderNotes);
    expect(saved.order?.items[0].adminNotes).toBe(itemNotes);
    expect(saved.form).toBe(changedItem.form);
  });

  it('tracks a draft save without losing the form values', () => {
    const form = { ...initialState.form, text: 'My situation' };
    const saving = orderFeature.reducer(
      { ...initialState, form },
      OrderActions.draftSaveClicked({ form }),
    );
    expect(saving.saveStatus).toBe('loading');
    const order = { id: 'order-1', status: 'draft', items: [] } as never;
    const saved = orderFeature.reducer(
      saving,
      OrderActions.saveSuccess({ result: { order, status: 'draft', fairgateUserExists: true } }),
    );
    expect(saved.order).toBe(order);
    expect(saved.form).toBe(form);
    expect(saved.saveStatus).toBe('success');
  });
  it('maps both wish title and description from the backend order', () => {
    const result = orderFeature.reducer(
      initialState,
      OrderActions.loadSuccess({
        overview: {
          order: {
            id: 'order-1',
            status: 'draft',
            adultsCount: 1,
            childrenCount: 0,
            currentText: 'Situation',
            items: [
              {
                id: 'item-1',
                category: 'gift',
                currentTitle: 'Winterjacke',
                currentDescription: 'Eine warme Jacke',
                personType: 'adult',
                personIndex: 1,
                personalMessage: null,
                currentReason: null,
              },
            ],
          } as never,
          year: 2026,
          fairgateStatus: 'valid',
          fairgateUserExists: true,
          childrenCount: 0,
          adultsCount: 1,
          canEdit: true,
        },
      }),
    );

    expect(result.form.items).toEqual([
      expect.objectContaining({
        title: 'Winterjacke',
        description: 'Eine warme Jacke',
      }),
    ]);
  });

  it('falls back to the title for legacy items without a description', () => {
    const result = orderFeature.reducer(
      initialState,
      OrderActions.loadSuccess({
        overview: {
          order: {
            id: 'order-1',
            status: 'draft',
            adultsCount: 1,
            childrenCount: 0,
            currentText: 'Situation',
            items: [
              {
                id: 'item-1',
                category: 'gift',
                currentTitle: 'Alter Wunsch',
                currentDescription: '',
                personType: 'adult',
                personIndex: 1,
                personalMessage: null,
                currentReason: null,
              },
            ],
          } as never,
          year: 2026,
          fairgateStatus: 'valid',
          fairgateUserExists: true,
          childrenCount: 0,
          adultsCount: 1,
          canEdit: true,
        },
      }),
    );

    expect(result.form.items[0].description).toBe('Alter Wunsch');
  });
});
