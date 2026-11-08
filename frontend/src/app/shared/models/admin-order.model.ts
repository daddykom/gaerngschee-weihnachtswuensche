import { OrderItemCategory, OrderItemPersonType, OrderStatus } from './order.model';

export type AdminPublicationStatus = 'draft' | 'submitted' | 'rejected' | 'approved';

export interface AdminOrderItem {
  id: string;
  orderId: string;
  itemNumber?: number | null;
  category: OrderItemCategory;
  personType?: OrderItemPersonType | null;
  personIndex?: number | null;
  originalTitle?: string;
  currentTitle?: string;
  originalDescription: string;
  currentDescription: string;
  giftLink?: string | null;
  originalReason: string | null;
  currentReason: string | null;
  personalMessage?: string | null;
  publicationStatus: AdminPublicationStatus;
  fulfillmentStatus: string;
  adminNotes: string | null;
}

export interface AdminOrder {
  id: string;
  userId: string;
  requesterEmail: string;
  year: number;
  orderNumber?: number | null;
  status: OrderStatus;
  adultsCount: number;
  childrenCount: number;
  originalText: string | null;
  currentText: string | null;
  adminNotes: string | null;
  items: AdminOrderItem[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminOrderFormValue {
  status: OrderStatus;
  currentText: string;
  adminNotes: string;
  adultsCount: number;
  childrenCount: number;
  items: Array<
    AdminOrderItem & {
      currentReason: string;
      currentTitle: string;
      adminNotes: string;
    }
  >;
}
