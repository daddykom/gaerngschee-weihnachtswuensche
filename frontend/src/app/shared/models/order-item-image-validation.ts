import { OrderItemImageChange } from './order-item-image.model';

export function imageChangeError(change: OrderItemImageChange | null | undefined): string | null {
  if (change?.operation !== 'replace') return null;
  if (change.file.size > 5 * 1024 * 1024) return 'tooLarge';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(change.file.type)) return 'fileType';
  return null;
}
