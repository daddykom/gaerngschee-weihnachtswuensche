import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AdminOrder, AdminOrderFormValue } from '../../shared/models/admin-order.model';
import {
  OrderItemImageChangeRequest,
  OrderItemImageState,
} from '../../shared/models/order-item-image.model';
import type { AdminOrderAction } from '../../shared/services/admin-orders.service';
import { AdminOrderSearchForm } from './admin-orders.state';

export const AdminOrdersActions = createActionGroup({
  source: 'Admin Orders',
  events: {
    'Image Editor Entered': props<{ orderId: string; itemId: string }>(),
    'Image Reload Clicked': props<{ orderId: string; itemId: string }>(),
    'Image Loaded': props<{
      orderId: string;
      itemId: string;
      data: OrderItemImageState;
      blob: Blob | null;
    }>(),
    'Image Load Failed': props<{ orderId: string; itemId: string; errorCode: string }>(),
    Load: emptyProps(),
    'Filters Changed': props<{ statuses: string[]; categories: string[] }>(),
    'Search Form Changed': props<{ changes: Partial<AdminOrderSearchForm> }>(),
    'Load Success': props<{ orders: AdminOrder[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    Save: props<{
      order: AdminOrder;
      action?: AdminOrderAction;
      imageChanges?: OrderItemImageChangeRequest[];
    }>(),
    'Form Loaded': props<{ orderId: string; form: AdminOrderFormValue }>(),
    'Form Changed': props<{ orderId: string; changes: Partial<AdminOrderFormValue> }>(),
    'Save Success': props<{ order: AdminOrder; mailSent: boolean }>(),
    'Save Failure': props<{ errorCode: string }>(),
  },
});
