import { FulfillerCategory, FulfillerOrder } from '../../shared/models/fulfiller-order.model';

export type FulfillerOrdersLoadStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type FulfillerOrdersReserveStatus = 'initial' | 'loading' | 'success' | 'error';

export interface FulfillerOrdersState {
  orders: FulfillerOrder[];
  search: string;
  category: FulfillerCategory | '';
  loadStatus: FulfillerOrdersLoadStatus;
  reserveStatus: FulfillerOrdersReserveStatus;
  errorCode: string | null;
  reserveErrorCode: string | null;
}

export const initialState: FulfillerOrdersState = {
  orders: [],
  search: '',
  category: '',
  loadStatus: 'initial',
  reserveStatus: 'initial',
  errorCode: null,
  reserveErrorCode: null,
};
