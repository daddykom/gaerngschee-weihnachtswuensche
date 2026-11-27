import { AdminOrder, AdminOrderFormValue } from '../../shared/models/admin-order.model';
import { OrderItemImageState } from '../../shared/models/order-item-image.model';

export type AdminItemImageRequest =
  | { status: 'initial' }
  | { status: 'loading'; orderId: string; itemId: string }
  | {
      status: 'loaded';
      orderId: string;
      itemId: string;
      data: OrderItemImageState;
      blob: Blob | null;
    }
  | { status: 'error'; orderId: string; itemId: string; errorCode: string };

export type AdminOrdersLoadStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type AdminOrdersSaveStatus = 'initial' | 'loading' | 'success' | 'error';

export interface AdminOrderSearchForm {
  email: string;
  orderNumber: string;
}

export interface AdminOrdersState {
  itemImage: AdminItemImageRequest;
  orders: AdminOrder[];
  statuses: string[];
  categories: string[];
  searchForm: AdminOrderSearchForm;
  loadStatus: AdminOrdersLoadStatus;
  saveStatus: AdminOrdersSaveStatus;
  errorCode: string | null;
  activeOrderId: string | null;
  form: AdminOrderFormValue | null;
}

export const initialState: AdminOrdersState = {
  itemImage: { status: 'initial' },
  orders: [],
  statuses: ['released', 'in_review'],
  categories: [],
  searchForm: { email: '', orderNumber: '' },
  loadStatus: 'initial',
  saveStatus: 'initial',
  errorCode: null,
  activeOrderId: null,
  form: null,
};
