export interface OrderItemImageMetadata {
  id: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  updatedAt: string;
}

export interface OrderItemImageState {
  revision: number;
  image: OrderItemImageMetadata | null;
}

export type OrderItemImageChange =
  | { operation: 'replace'; revision: number; file: File }
  | { operation: 'remove'; revision: number };

export interface OrderItemImageChangeRequest {
  itemId: string;
  change: OrderItemImageChange;
}
