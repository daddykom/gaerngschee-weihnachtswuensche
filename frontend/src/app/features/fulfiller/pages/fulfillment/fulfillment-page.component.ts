import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { FulfillerWish } from '../../../../shared/models/fulfiller-order.model';
import { FulfillerOrdersActions } from '../../../../store/fulfiller-orders/fulfiller-orders.actions';
import {
  selectFulfillerOrders,
  selectFulfillerOrdersCategory,
  selectFulfillerOrdersLoadStatus,
  selectFulfillerOrdersSearch,
} from '../../../../store/fulfiller-orders/fulfiller-orders.feature';
import { FulfillmentListComponent } from '../../components/fulfillment-list/fulfillment-list.component';
import { FulfillerReservationDialog } from '../../components/reservation-dialog/fulfiller-reservation-dialog';

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

  constructor() {
    this.store.dispatch(FulfillerOrdersActions.pollingStarted());
  }

  searchChanged(search: string): void {
    this.store.dispatch(FulfillerOrdersActions.searchChanged({ search }));
  }

  categoryChanged(category: 'gift' | 'voucher' | ''): void {
    this.store.dispatch(FulfillerOrdersActions.categoryChanged({ category }));
  }

  reserve(wish: FulfillerWish): void {
    if (wish.fulfillmentStatus !== 'available') {
      return;
    }

    this.store.dispatch(FulfillerOrdersActions.reservationStarted({ itemId: wish.id }));
    this.dialog.open(FulfillerReservationDialog, {
      data: wish,
      width: 'calc(100vw - 2rem)',
      maxWidth: '40rem',
    });
  }
}
