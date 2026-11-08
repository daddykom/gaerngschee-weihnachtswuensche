export type OrderItemStatus =
  | 'draft'
  | 'submitted'
  | 'rejected'
  | 'approved'
  | 'reserved'
  | 'received'
  | 'completed';

export type OrderItemCategory = 'voucher' | 'gift';

export interface OrderItemFormValue {
  id: string;
  category: OrderItemCategory | null;
  description: string;
  reason: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemNumber?: number | null;
  category: OrderItemCategory;
  originalDescription: string;
  currentDescription: string;
  originalReason: string | null;
  currentReason: string | null;
  status: OrderItemStatus;
  fulfillerEmail: string | null;
  reservedAt: string | null;
  dueAt: string | null;
  receivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type OrderStatus =
  | 'draft'
  | 'waiting_for_fairgate'
  | 'released'
  | 'family_size_exceeded'
  | 'in_review'
  | 'changes_requested'
  | 'definitive'
  | 'ready_for_pickup'
  | 'completed';

export interface Order {
  id: string;
  userId: string;
  year: number;
  orderNumber?: number | null;
  status: OrderStatus;
  adultsCount: number;
  childrenCount: number;
  originalText: string | null;
  currentText: string | null;
  items: OrderItem[];
  fairgateStatus: string | null;
  confirmationEmailSentAt: string | null;
  fairgateReminderEmailSentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OrderOverviewResponse {
  order: Order | null;
  year: number;
  fairgateStatus: string;
  fairgateUserExists: boolean;
  childrenCount: number | null;
  adultsCount: number | null;
  canEdit: boolean;
}

export interface OrderFormValue {
  password: string;
  passwordConfirmation: string;
  adultsCount: number | null;
  childrenCount: number | null;
  text: string;
  items: OrderItemFormValue[];
}

export interface SaveOrderResponse {
  order: Order;
  status: OrderStatus;
  fairgateUserExists: boolean;
}
