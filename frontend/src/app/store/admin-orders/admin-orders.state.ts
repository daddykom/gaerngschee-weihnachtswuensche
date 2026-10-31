import { AdminOrder, AdminOrderFormValue } from '../../shared/models/admin-order.model';

export type AdminOrdersLoadStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type AdminOrdersSaveStatus = 'initial' | 'loading' | 'success' | 'error';

export interface AdminOrdersState {
  orders: AdminOrder[];
  statuses: string[];
  categories: string[];
  loadStatus: AdminOrdersLoadStatus;
  saveStatus: AdminOrdersSaveStatus;
  errorCode: string | null;
  activeOrderId: string | null;
  form: AdminOrderFormValue | null;
}

export const initialState: AdminOrdersState = {
  orders: [],
  statuses: ['released', 'in_review'],
  categories: [],
  loadStatus: 'initial',
  saveStatus: 'initial',
  errorCode: null,
  activeOrderId: null,
  form: null,
};
