import { GiftReceiptResult } from '../models/gift-receipt.model';

export function receiptConfirmation(result: GiftReceiptResult) {
  const item = result.order.items.find((item) => item.id === result.selectedItemId);
  if (
    result.order.status !== 'definitive' ||
    !item ||
    item.publicationStatus !== 'approved' ||
    !['available', 'pending_confirmation', 'reserved'].includes(item.fulfillmentStatus) ||
    item.receivedAt !== null ||
    !item.giftNumber
  )
    return null;
  return {
    giftNumber: item.giftNumber,
    confirmUnreserved: item.fulfillmentStatus !== 'reserved',
    confirmPickup: result.order.items
      .filter((other) => other.id !== item.id && other.publicationStatus === 'approved')
      .every(
        (other) =>
          ['received', 'completed'].includes(other.fulfillmentStatus) && other.receivedAt !== null,
      ),
  };
}
