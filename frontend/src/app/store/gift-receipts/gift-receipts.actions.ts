import { createActionGroup, props } from '@ngrx/store';
import { GiftReceiptResult } from '../../shared/models/gift-receipt.model';
import { GiftReceiptForm } from './gift-receipts.state';

export const GiftReceiptsActions = createActionGroup({
  source: 'Gift Receipts',
  events: {
    'Form Changed': props<{ changes: Partial<GiftReceiptForm> }>(),
    'Search Submitted': props<{ giftNumber: string }>(),
    'Search Succeeded': props<{ result: GiftReceiptResult }>(),
    'Search Failed': props<{ errorCode: string }>(),
  },
});
