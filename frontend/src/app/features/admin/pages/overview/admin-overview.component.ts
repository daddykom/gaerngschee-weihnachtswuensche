import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminOrder, AdminOrderItem } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrders,
  selectAdminOrdersLoadStatus,
  selectAdminOrdersSaveStatus,
} from '../../../../store/admin-orders/admin-orders.feature';
import { Store } from '@ngrx/store';

interface AdminOrderFormItem extends AdminOrderItem {
  currentReason: string;
  adminNotes: string;
}

interface AdminOrderFormValue {
  currentText: string;
  adminNotes: string;
  adultsCount: number;
  childrenCount: number;
  items: AdminOrderFormItem[];
}

@Component({
  selector: 'app-admin-overview',
  imports: [TranslatePipe, FormField, MatButtonModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {
  private readonly store = inject(Store);
  readonly orders = this.store.selectSignal(selectAdminOrders);
  readonly loadStatus = this.store.selectSignal(selectAdminOrdersLoadStatus);
  readonly saveStatus = this.store.selectSignal(selectAdminOrdersSaveStatus);
  readonly selectedStatuses = signal<string[]>(['released', 'in_review']);
  readonly selectedCategories = signal<string[]>([]);
  readonly selectedOrder = signal<AdminOrder | null>(null);
  readonly formModel = signal<AdminOrderFormValue>({ currentText: '', adminNotes: '', adultsCount: 0, childrenCount: 0, items: [] });
  readonly orderForm = form(this.formModel, (schema) => {
    required(schema.currentText);
  });
  readonly statusOptions = ['released', 'in_review', 'changes_requested', 'definitive', 'ready_for_pickup', 'completed'];
  readonly categoryOptions = ['gift', 'voucher'];
  readonly hasUnacceptedItems = computed(() => this.formModel().items.some((item) => item.publicationStatus !== 'approved'));
  readonly canRejectOrder = computed(() => this.formModel().items.some((item) => item.publicationStatus === 'rejected' && item.adminNotes.trim() !== ''));

  constructor() {
    this.load();
    effect(() => {
      const orders = this.orders();
      const selected = this.selectedOrder();
      if (selected !== null) {
        const refreshed = orders.find((order) => order.id === selected.id);
        if (refreshed !== undefined && this.saveStatus() === 'success') {
          this.openOrder(refreshed);
        }
      }
    });
    effect(() => {
      if (this.saveStatus() === 'success') {
        this.selectedOrder.set(null);
        this.load();
      }
    });
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

  openOrder(order: AdminOrder): void {
    this.selectedOrder.set(order);
    this.formModel.set({
      currentText: order.currentText ?? '',
      adminNotes: order.adminNotes ?? '',
      adultsCount: order.adultsCount,
      childrenCount: order.childrenCount,
      items: order.items.map((item) => ({ ...item, currentReason: item.currentReason ?? '', adminNotes: item.adminNotes ?? '' })),
    });
  }

  closeOrder(): void {
    this.selectedOrder.set(null);
  }

  setItemStatus(itemId: string, status: 'approved' | 'rejected'): void {
    this.formModel.update((model) => ({
      ...model,
      items: model.items.map((item) => item.id === itemId ? { ...item, publicationStatus: status } : item),
    }));
  }

  save(status: 'in_review' | 'definitive' | 'changes_requested'): void {
    const order = this.selectedOrder();
    if (order === null || this.orderForm().valid() === false || this.formModel().items.some((item) => item.currentDescription.trim() === '') || this.formModel().items.some((item) => item.publicationStatus === 'rejected' && item.adminNotes.trim() === '') || (status === 'definitive' && this.hasUnacceptedItems())) {
      this.orderForm().markAsTouched();
      return;
    }
    this.store.dispatch(AdminOrdersActions.save({ order: {
      ...order,
      ...this.formModel(),
      status,
      items: this.formModel().items.map((item) => ({ ...item })),
    } }));
  }

  itemHasReason(item: AdminOrderItem): boolean {
    return item.publicationStatus !== 'rejected' || (item.adminNotes ?? '').trim().length > 0;
  }
}
