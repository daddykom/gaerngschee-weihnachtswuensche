import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  FulfillerCategory,
  FulfillerOrder,
  FulfillerWishStatusUpdate,
} from '../../shared/models/fulfiller-order.model';

export const FulfillerOrdersActions = createActionGroup({
  source: 'Fulfiller Orders',
  events: {
    Load: emptyProps(),
    'Search Changed': props<{ search: string }>(),
    'Category Changed': props<{ category: FulfillerCategory | '' }>(),
    'Load Success': props<{ orders: FulfillerOrder[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    'Reservation Form Changed': props<{
      changes: Partial<{ email: string; privacyAccepted: boolean }>;
    }>(),
    'Reservation Started': props<{ itemId: string }>(),
    'Reservation Submitted': emptyProps(),
    'Reservation Request Success': props<{
      itemId: string;
      reservationExpiresAt: string;
    }>(),
    'Reservation Request Failure': props<{ errorCode: string }>(),
    'Polling Started': emptyProps(),
    'Wish Statuses Updated': props<{ items: FulfillerWishStatusUpdate[] }>(),
  },
});
