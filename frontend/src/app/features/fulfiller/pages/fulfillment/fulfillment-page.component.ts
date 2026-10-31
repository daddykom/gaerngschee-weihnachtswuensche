import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { FulfillerWish } from '../../../../shared/models/fulfiller-order.model';
import { FulfillerOrdersActions } from '../../../../store/fulfiller-orders/fulfiller-orders.actions';
import {
  selectFulfillerOrders,
  selectFulfillerOrdersCategory,
  selectFulfillerOrdersLoadStatus,
  selectFulfillerOrdersReserveStatus,
  selectFulfillerOrdersSearch,
} from '../../../../store/fulfiller-orders/fulfiller-orders.feature';
import { FulfillmentListComponent } from '../../components/fulfillment-list/fulfillment-list.component';

@Component({
  selector: 'app-fulfillment-page',
  imports: [FulfillmentListComponent],
  templateUrl: './fulfillment-page.component.html',
  styleUrl: './fulfillment-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FulfillmentPageComponent {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  readonly orders = this.store.selectSignal(selectFulfillerOrders);
  readonly search = this.store.selectSignal(selectFulfillerOrdersSearch);
  readonly category = this.store.selectSignal(selectFulfillerOrdersCategory);
  readonly loadStatus = this.store.selectSignal(selectFulfillerOrdersLoadStatus);
  readonly reserveStatus = this.store.selectSignal(selectFulfillerOrdersReserveStatus);

  searchChanged(search: string): void {
    this.store.dispatch(FulfillerOrdersActions.searchChanged({ search }));
  }

  categoryChanged(category: 'gift' | 'voucher' | ''): void {
    this.store.dispatch(FulfillerOrdersActions.categoryChanged({ category }));
  }

  reserve(wish: FulfillerWish): void {
    if (wish.fulfillmentStatus !== 'available' || this.reserveStatus() === 'loading') {
      return;
    }

    const dialog = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'app.fulfiller.reserveTitle',
        message: 'app.fulfiller.reserveMessage',
        confirmLabel: 'app.fulfiller.reserveConfirm',
        cancelLabel: 'app.fulfiller.cancel',
      },
    });

    dialog
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.store.dispatch(FulfillerOrdersActions.reserve({ itemId: wish.id }));
        }
      });
  }
}
