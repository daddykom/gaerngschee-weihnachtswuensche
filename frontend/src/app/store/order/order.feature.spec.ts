import { OrderActions } from './order.actions';
import { orderFeature } from './order.feature';
import { initialState } from './order.state';

describe('orderFeature', () => {
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
