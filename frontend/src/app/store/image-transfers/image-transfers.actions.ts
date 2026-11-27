import { createActionGroup, props } from '@ngrx/store';
import { OrderItemImageState } from '../../shared/models/order-item-image.model';
import { QueuedImageTransfer } from './image-transfers.state';

export const ImageTransfersActions = createActionGroup({
  source: 'Image Transfers',
  events: {
    'Transfers Queued': props<{ transfers: QueuedImageTransfer[] }>(),
    'Transfer Started': props<{ id: string }>(),
    'Transfer Progressed': props<{ id: string; percent: number }>(),
    'Transfer Succeeded': props<{ id: string; result: OrderItemImageState }>(),
    'Transfer Failed': props<{ id: string; errorCode: string }>(),
    'Retry Clicked': props<{ id: string }>(),
    'Dismiss Clicked': props<{ id: string }>(),
  },
});
