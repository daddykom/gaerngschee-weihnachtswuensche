import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ORDER_STATUS_WORKFLOW } from '../../../../shared/models/order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminFilteredOrders,
  selectAdminOrderCategories,
  selectAdminOrderSearchForm,
  selectAdminOrdersLoadStatus,
  selectAdminOrderStatuses,
} from '../../../../store/admin-orders/admin-orders.feature';

@Component({
  selector: 'app-admin-overview',
  imports: [
    TranslatePipe,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormField,
  ],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {
  private readonly store = inject(Store);
  readonly orders = this.store.selectSignal(selectAdminFilteredOrders);
  readonly itemCount = computed(() =>
    this.orders().reduce((total, order) => total + order.items.length, 0),
  );
  readonly searchFormValue = this.store.selectSignal(selectAdminOrderSearchForm);
  readonly searchModel = linkedSignal(() => this.searchFormValue());
  readonly searchForm = form(this.searchModel);
  readonly loadStatus = this.store.selectSignal(selectAdminOrdersLoadStatus);
  readonly selectedStatuses = this.store.selectSignal(selectAdminOrderStatuses);
  readonly selectedCategories = this.store.selectSignal(selectAdminOrderCategories);
  readonly statusOptions = ORDER_STATUS_WORKFLOW;
  readonly categoryOptions = ['gift', 'voucher'];

  constructor() {
    effect(() => {
      const email = this.searchModel().email;
      if (email !== this.searchFormValue().email) {
        this.store.dispatch(AdminOrdersActions.searchFormChanged({ changes: { email } }));
      }
    });
  }

  statusChanged(statuses: string[]): void {
    this.store.dispatch(
      AdminOrdersActions.filtersChanged({ statuses, categories: this.selectedCategories() }),
    );
  }

  categoryChanged(categories: string[]): void {
    this.store.dispatch(
      AdminOrdersActions.filtersChanged({ statuses: this.selectedStatuses(), categories }),
    );
  }

  removeStatus(status: string): void {
    this.statusChanged(this.selectedStatuses().filter((value) => value !== status));
  }

  removeCategory(category: string): void {
    this.categoryChanged(this.selectedCategories().filter((value) => value !== category));
  }
}
