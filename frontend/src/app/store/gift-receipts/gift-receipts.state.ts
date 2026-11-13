import { GiftReceiptResult } from '../../shared/models/gift-receipt.model';

export interface GiftReceiptForm {
  giftNumber: string;
}

export type GiftReceiptLookup =
  | { status: 'initial' }
  | { status: 'loading' }
  | { status: 'loaded'; result: GiftReceiptResult }
  | { status: 'error'; errorCode: string };

export interface GiftReceiptsState {
  form: GiftReceiptForm;
  lookup: GiftReceiptLookup;
}

export const initialState: GiftReceiptsState = {
  form: { giftNumber: '' },
  lookup: { status: 'initial' },
};
