import { AdminOrder, AdminOrderFormValue } from '../../shared/models/admin-order.model';

export type AdminOrdersLoadStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type AdminOrdersSaveStatus = 'initial' | 'loading' | 'success' | 'error';

export interface AdminOrderSearchForm {
  email: string;
  orderNumber: string;
}

export interface AdminOrdersState {
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
