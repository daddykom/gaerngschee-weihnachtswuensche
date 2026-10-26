import { OrderItemCategory, OrderStatus } from './order.model';

export type AdminPublicationStatus = 'draft' | 'submitted' | 'rejected' | 'approved';

export interface AdminOrderItem {
  id: string;
  orderId: string;
  category: OrderItemCategory;
  originalDescription: string;
  currentDescription: string;
  originalReason: string | null;
  currentReason: string | null;
  publicationStatus: AdminPublicationStatus;
  fulfillmentStatus: string;
  adminNotes: string | null;
}

export interface AdminOrder {
  id: string;
  userId: string;
  requesterEmail: string;
  year: number;
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
