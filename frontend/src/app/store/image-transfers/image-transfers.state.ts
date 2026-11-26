import {
  OrderItemImageChange,
  OrderItemImageState,
} from '../../shared/models/order-item-image.model';

interface ImageTransferIdentity {
  id: string;
  orderId: string;
  itemId: string;
}

export interface QueuedImageTransfer extends ImageTransferIdentity {
  status: 'queued';
  change: OrderItemImageChange;
}

export type ImageTransfer =
  | QueuedImageTransfer
  | (ImageTransferIdentity & {
      status: 'uploading';
      change: OrderItemImageChange;
      percent: number;
    })
  | (ImageTransferIdentity & {
      status: 'success';
      result: OrderItemImageState;
    })
  | (ImageTransferIdentity & {
      status: 'error';
      change: OrderItemImageChange;
      errorCode: string;
    });

export interface ImageTransfersState {
  transfers: ImageTransfer[];
}

export const initialImageTransfersState: ImageTransfersState = { transfers: [] };
