import { OrderItemPersonType } from './order.model';

export type FulfillerCategory = 'gift' | 'voucher';
export type FulfillerWishStatus = 'available' | 'pending_confirmation' | 'reserved';

export interface FulfillerWish {
  id: string;
  itemNumber: number;
  wishNumber: string;
  category: FulfillerCategory;
  personType?: OrderItemPersonType | null;
  personIndex?: number | null;
  title?: string;
  currentDescription: string;
  giftLink?: string | null;
  fulfillmentStatus: FulfillerWishStatus;
  reservedAt: string | null;
  reservationExpiresAt: string | null;
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

export interface FulfillerWishStatusUpdate {
  id: string;
  fulfillmentStatus: FulfillerWishStatus;
  reservedAt: string | null;
  reservationExpiresAt: string | null;
}

export interface FulfillerWishStatusesResponse {
  items: FulfillerWishStatusUpdate[];
}

export interface FulfillerReservationResponse {
  sent: boolean;
  itemId: string;
  reservationExpiresAt: string;
}
