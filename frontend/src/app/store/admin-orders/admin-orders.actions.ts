import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AdminOrder, AdminOrderFormValue } from '../../shared/models/admin-order.model';
import type { AdminOrderAction } from '../../shared/services/admin-orders.service';

export const AdminOrdersActions = createActionGroup({
  source: 'Admin Orders',
  events: {
    Load: emptyProps(),
    'Filters Changed': props<{ statuses: string[]; categories: string[] }>(),
    'Load Success': props<{ orders: AdminOrder[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    Save: props<{ order: AdminOrder; action?: AdminOrderAction }>(),
    'Draft Changed': props<{ order: AdminOrder }>(),
    'Form Loaded': props<{ orderId: string; form: AdminOrderFormValue }>(),
    'Form Changed': props<{ orderId: string; changes: Partial<AdminOrderFormValue> }>(),
    'Save Success': props<{ order: AdminOrder }>(),
    'Save Failure': props<{ errorCode: string }>(),
  },
});
