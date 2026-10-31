import { FulfillerCategory, FulfillerOrder } from '../../shared/models/fulfiller-order.model';

export type FulfillerOrdersLoadStatus = 'initial' | 'loading' | 'loaded' | 'error';
export type FulfillerOrdersReserveStatus = 'initial' | 'loading' | 'success' | 'error';

export interface FulfillerReservationForm {
  itemId: string | null;
  email: string;
  privacyAccepted: boolean;
}

export interface FulfillerOrdersState {
  orders: FulfillerOrder[];
  search: string;
  category: FulfillerCategory | '';
  loadStatus: FulfillerOrdersLoadStatus;
  errorCode: string | null;
  reservationForm: FulfillerReservationForm;
  reservationStatus: FulfillerOrdersReserveStatus;
  reservationErrorCode: string | null;
}

export const initialState: FulfillerOrdersState = {
  orders: [],
  search: '',
  category: '',
  loadStatus: 'initial',
  errorCode: null,
  reservationForm: { itemId: null, email: '', privacyAccepted: false },
  reservationStatus: 'initial',
  reservationErrorCode: null,
};
