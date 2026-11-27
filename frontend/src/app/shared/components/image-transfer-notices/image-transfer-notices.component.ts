import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ImageTransfer } from '../../../store/image-transfers/image-transfers.state';
import { isRetryableImageError } from '../../models/order-item-image-retry';
import { InfoBoxComponent } from '../info-box/info-box';

@Component({
  imports: [InfoBoxComponent, MatButtonModule, RouterLink, TranslatePipe],
  selector: 'app-image-transfer-notices',
  styleUrl: './image-transfer-notices.component.scss',
  templateUrl: './image-transfer-notices.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageTransferNoticesComponent {
  readonly transfers = input.required<ImageTransfer[]>();
  readonly retryClicked = output<string>();
  readonly dismissClicked = output<string>();
  readonly canRetry = isRetryableImageError;

  errorMessageKey(errorCode: string): string {
    switch (errorCode) {
      case 'IMAGE_REVISION_CONFLICT':
        return 'app.imageTransfers.errors.conflict';
      case 'IMAGE_TOO_LARGE':
        return 'app.imageTransfers.errors.tooLarge';
      case 'IMAGE_DIMENSIONS_EXCEEDED':
        return 'app.imageTransfers.errors.dimensions';
      case 'INVALID_IMAGE':
      case 'IMAGE_REQUIRED':
      case 'IMAGE_REVISION_REQUIRED':
        return 'app.imageTransfers.errors.invalidImage';
      case 'ORDER_ITEM_NOT_FOUND':
      case 'IMAGE_NOT_FOUND':
      case 'NOT_FOUND':
        return 'app.imageTransfers.errors.notFound';
      default:
        return 'app.imageTransfers.errors.failed';
    }
  }
}
