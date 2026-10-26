import { createActionGroup, props } from '@ngrx/store';
import { AdminOrder } from '../../shared/models/admin-order.model';

export const AdminOrdersActions = createActionGroup({
  source: 'Admin Orders',
  events: {
    Load: props<{ statuses: string[]; categories: string[] }>(),
    'Load Success': props<{ orders: AdminOrder[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    Save: props<{ order: AdminOrder }>(),
    'Save Success': props<{ order: AdminOrder }>(),
    'Save Failure': props<{ errorCode: string }>(),
  },
});
