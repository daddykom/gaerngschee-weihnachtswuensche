import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  OrderFormValue,
  OrderItemFormValue,
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
    'Item Form Changed': props<{
      itemId: string;
      changes: Partial<OrderItemFormValue>;
    }>(),
    Save: props<{ form: OrderFormValue }>(),
    'Save Success': props<{ result: SaveOrderResponse }>(),
    'Save Failure': props<{ errorCode: string }>(),
  },
});
