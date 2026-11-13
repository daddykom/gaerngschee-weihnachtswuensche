import { AdminPublicationStatus } from './admin-order.model';
import { OrderItemCategory, OrderStatus } from './order.model';

export interface GiftReceiptItem {
  id: string;
  itemNumber: number | null;
  giftNumber: string | null;
  category: OrderItemCategory;
  currentTitle: string;
  currentDescription: string;
  publicationStatus: AdminPublicationStatus;
  fulfillmentStatus: 'available' | 'pending_confirmation' | 'reserved' | 'received' | 'completed';
  receivedAt: string | null;
}

export interface GiftReceiptResult {
  campaignYear: number;
  selectedItemId: string;
  order: {
    id: string;
    year: number;
    orderNumber: number;
    status: OrderStatus;
    items: GiftReceiptItem[];
  };
}

export interface GiftReceiptResponse extends GiftReceiptResult {
  alreadyReceived: boolean;
  mailStatus: 'not_required' | 'sent' | 'pending';
}
