import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { GiftReceiptResponse, GiftReceiptResult } from '../../shared/models/gift-receipt.model';
import { GiftReceiptForm } from './gift-receipts.state';

export const GiftReceiptsActions = createActionGroup({
  source: 'Gift Receipts',
  events: {
    'Form Changed': props<{ changes: Partial<GiftReceiptForm> }>(),
    'Search Submitted': props<{ giftNumber: string }>(),
    'Search Succeeded': props<{ result: GiftReceiptResult }>(),
    'Search Failed': props<{ errorCode: string }>(),
    'Receipt Requested': emptyProps(),
    'Receipt Confirmed': props<{
      giftNumber: string;
      confirmUnreserved: boolean;
      confirmPickup: boolean;
    }>(),
    'Receipt Cancelled': emptyProps(),
    'Receipt Succeeded': props<{ response: GiftReceiptResponse }>(),
    'Receipt Failed': props<{ errorCode: string; result?: GiftReceiptResult }>(),
  },
});
