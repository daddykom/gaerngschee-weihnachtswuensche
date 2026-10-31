export type FulfillerCategory = 'gift' | 'voucher';
export type FulfillerWishStatus = 'available' | 'reserved';

export interface FulfillerWish {
  id: string;
  itemNumber: number;
  wishNumber: string;
  category: FulfillerCategory;
  currentDescription: string;
  currentReason: string | null;
  fulfillmentStatus: FulfillerWishStatus;
  reservedAt: string | null;
}

export interface FulfillerOrder {
  id: string;
  year: number;
  orderNumber: number;
  currentText: string | null;
  items: FulfillerWish[];
}

export interface FulfillerOrdersResponse {
  orders: FulfillerOrder[];
}

export interface ReserveWishResponse {
  item: {
    orderId: string;
    id: string;
    itemNumber: number;
    fulfillmentStatus: 'reserved';
    reservedAt: string | null;
  };
}
