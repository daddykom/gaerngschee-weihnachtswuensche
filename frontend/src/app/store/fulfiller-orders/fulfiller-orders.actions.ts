import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { FulfillerCategory, FulfillerOrder } from '../../shared/models/fulfiller-order.model';

export const FulfillerOrdersActions = createActionGroup({
  source: 'Fulfiller Orders',
  events: {
    Load: emptyProps(),
    'Search Changed': props<{ search: string }>(),
    'Category Changed': props<{ category: FulfillerCategory | '' }>(),
    'Load Success': props<{ orders: FulfillerOrder[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    Reserve: props<{ itemId: string }>(),
    'Reserve Success': props<{
      orderId: string;
      itemId: string;
      reservedAt: string | null;
    }>(),
    'Reserve Failure': props<{ errorCode: string }>(),
  },
});
