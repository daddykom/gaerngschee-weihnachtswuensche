import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  OrderFormValue,
  OrderOverviewResponse,
  SaveOrderResponse,
} from '../../shared/models/order.model';

export const OrderActions = createActionGroup({
  source: 'Order',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ overview: OrderOverviewResponse }>(),
    'Load Failure': props<{ errorCode: string }>(),
    'Form Changed': props<{ changes: Partial<OrderFormValue> }>(),
    Save: props<{ form: OrderFormValue }>(),
    'Save Success': props<{ result: SaveOrderResponse }>(),
    'Save Failure': props<{ errorCode: string }>(),
  },
});
