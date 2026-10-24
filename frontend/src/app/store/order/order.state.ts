import { Order, OrderFormValue } from '../../shared/models/order.model';

export type OrderLoadStatus = 'initial' | 'loading' | 'loaded' | 'error';

export interface OrderState {
  status: OrderLoadStatus;
  order: Order | null;
  year: number | null;
  fairgateStatus: string | null;
  fairgateUserExists: boolean | null;
  childrenCount: number | null;
  adultsCount: number | null;
  form: OrderFormValue;
  errorCode: string | null;
}

export const initialState: OrderState = {
  status: 'initial',
  order: null,
  year: null,
  fairgateStatus: null,
  fairgateUserExists: null,
  childrenCount: null,
  adultsCount: null,
  form: {
    password: '',
    passwordConfirmation: '',
    adultsCount: null,
    childrenCount: null,
    text: '',
  },
  errorCode: null,
};
