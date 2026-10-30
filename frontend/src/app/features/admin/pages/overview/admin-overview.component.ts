import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrders,
  selectAdminOrdersLoadStatus,
} from '../../../../store/admin-orders/admin-orders.feature';

@Component({
  selector: 'app-admin-overview',
  imports: [TranslatePipe, RouterLink, MatButtonModule, MatChipsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {
  private readonly store = inject(Store);
  readonly orders = this.store.selectSignal(selectAdminOrders);
  readonly loadStatus = this.store.selectSignal(selectAdminOrdersLoadStatus);
  readonly selectedStatuses = signal<string[]>(['released', 'in_review']);
  readonly selectedCategories = signal<string[]>([]);
  readonly statusOptions = ['released', 'in_review', 'changes_requested', 'definitive', 'ready_for_pickup', 'completed'];
  readonly categoryOptions = ['gift', 'voucher'];

  constructor() {
    this.load();
  }

  load(): void {
    this.store.dispatch(AdminOrdersActions.load({ statuses: this.selectedStatuses(), categories: this.selectedCategories() }));
  }

  statusChanged(statuses: string[]): void {
    this.selectedStatuses.set(statuses);
    this.load();
  }

  categoryChanged(categories: string[]): void {
    this.selectedCategories.set(categories);
    this.load();
  }

  removeStatus(status: string): void {
    this.statusChanged(this.selectedStatuses().filter((value) => value !== status));
  }

  removeCategory(category: string): void {
    this.categoryChanged(this.selectedCategories().filter((value) => value !== category));
  }
}
