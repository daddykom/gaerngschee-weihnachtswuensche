import { GiftReceiptResult } from '../models/gift-receipt.model';
import { receiptConfirmation } from './gift-receipt';

describe('receiptConfirmation', () => {
  const result: GiftReceiptResult = {
    campaignYear: 2026,
    selectedItemId: 'one',
    order: {
      id: 'order',
      year: 2026,
      orderNumber: 12,
      status: 'definitive',
      items: [
        {
          id: 'one',
          itemNumber: 1,
          giftNumber: '12-1',
          category: 'gift',
          currentTitle: 'Coat',
          currentDescription: 'Coat',
          publicationStatus: 'approved',
          fulfillmentStatus: 'reserved',
          receivedAt: null,
        },
      ],
    },
  };

  it('requires pickup confirmation for the last approved gift', () => {
    expect(receiptConfirmation(result)).toEqual({
      giftNumber: '12-1',
      confirmUnreserved: false,
      confirmPickup: true,
    });
  });
  it('warns for an unreserved gift and waits for other missing gifts', () => {
    const items = [
      { ...result.order.items[0], fulfillmentStatus: 'available' as const },
      { ...result.order.items[0], id: 'two', giftNumber: '12-2' },
    ];
    expect(receiptConfirmation({ ...result, order: { ...result.order, items } })).toEqual({
      giftNumber: '12-1',
      confirmUnreserved: true,
      confirmPickup: false,
    });
  });
  it('does not offer receipt for a received gift or a non-definitive order', () => {
    expect(
      receiptConfirmation({ ...result, order: { ...result.order, status: 'ready_for_pickup' } }),
    ).toBeNull();
    expect(
      receiptConfirmation({
        ...result,
        order: {
          ...result.order,
          items: [
            { ...result.order.items[0], fulfillmentStatus: 'received', receivedAt: '2026-11-13' },
          ],
        },
      }),
    ).toBeNull();
  });
});
