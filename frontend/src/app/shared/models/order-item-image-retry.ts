export function isRetryableImageError(errorCode: string): boolean {
  return ![
    'IMAGE_REVISION_CONFLICT',
    'IMAGE_TOO_LARGE',
    'IMAGE_DIMENSIONS_EXCEEDED',
    'INVALID_IMAGE',
    'IMAGE_REQUIRED',
    'IMAGE_REVISION_REQUIRED',
    'ORDER_ITEM_NOT_FOUND',
    'IMAGE_NOT_FOUND',
    'NOT_FOUND',
  ].includes(errorCode);
}
