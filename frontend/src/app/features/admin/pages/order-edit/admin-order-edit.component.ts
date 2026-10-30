import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminOrder, AdminOrderItem } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrders,
  selectAdminOrdersSaveStatus,
} from '../../../../store/admin-orders/admin-orders.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';

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
  selector: 'app-admin-order-edit',
  imports: [
    TranslatePipe,
    RouterLink,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './admin-order-edit.component.html',
  styleUrl: './admin-order-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderEditComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  readonly orders = this.store.selectSignal(selectAdminOrders);
  readonly saveStatus = this.store.selectSignal(selectAdminOrdersSaveStatus);
  readonly order = signal<AdminOrder | null>(null);
  readonly formModel = signal<AdminOrderFormValue>({
    currentText: '',
    adminNotes: '',
    adultsCount: 0,
    childrenCount: 0,
    items: [],
  });
  readonly orderForm = form(this.formModel, (schema) => required(schema.currentText));
  readonly allItemsApproved = computed(
    () =>
      this.formModel().items.length > 0 &&
      this.formModel().items.every((item) => item.publicationStatus === 'approved'),
  );
  readonly hasRejectedItem = computed(() =>
    this.formModel().items.some((item) => item.publicationStatus === 'rejected'),
  );
  readonly canRejectOrder = computed(
    () => this.hasRejectedItem() || this.formModel().adminNotes.trim() !== '',
  );

  cancel(): void {
    this.store.dispatch(NavigationActions.navigate({ target: 'back' }));
  }

  constructor() {
    effect(() => {
      const id = this.route.snapshot.paramMap.get('orderId');
      const currentOrder = this.orders().find((order) => order.id === id);
      if (currentOrder !== undefined && this.order() === null) {
        const rejectItem = this.route.snapshot.queryParamMap.get('rejectItem');
        this.order.set(currentOrder);
        this.formModel.set({
          currentText: currentOrder.currentText ?? '',
          adminNotes: currentOrder.adminNotes ?? '',
          adultsCount: currentOrder.adultsCount,
          childrenCount: currentOrder.childrenCount,
          items: currentOrder.items.map((item) => ({
            ...item,
            currentReason: item.currentReason ?? '',
            adminNotes: item.adminNotes ?? '',
            publicationStatus: item.id === rejectItem ? 'rejected' : item.publicationStatus,
          })),
        });
      }
    });
  }

  save(): void {
    const order = this.order();
    const model = this.formModel();
    if (
      order === null ||
      !this.orderForm().valid() ||
      model.items.some((item) => item.currentDescription.trim() === '') ||
      model.items.some(
        (item) => item.publicationStatus === 'rejected' && item.adminNotes.trim() === '',
      )
    ) {
      this.orderForm().markAsTouched();
      return;
    }
    const hasRejectedItem = model.items.some((item) => item.publicationStatus === 'rejected');
    this.store.dispatch(
      AdminOrdersActions.save({
        order: {
          ...order,
          ...model,
          status: hasRejectedItem ? 'changes_requested' : order.status,
          items: model.items.map((item) => ({ ...item })),
        },
        action: 'save',
      }),
    );
  }

  rejectOrder(): void {
    const order = this.order();
    const model = this.formModel();
    if (order === null || !this.canRejectOrder()) {
      this.orderForm().markAsTouched();
      return;
    }
    this.store.dispatch(
      AdminOrdersActions.save({
        order: {
          ...order,
          ...model,
          status: 'changes_requested',
          items: model.items.map((item) => ({ ...item })),
        },
        action: 'rejectOrder',
      }),
    );
  }

  releaseOrder(): void {
    const order = this.order();
    const model = this.formModel();
    if (order === null || !this.allItemsApproved()) return;
    this.store.dispatch(
      AdminOrdersActions.save({
        order: {
          ...order,
          ...model,
          status: 'definitive',
          items: model.items.map((item) => ({ ...item })),
        },
        action: 'release',
      }),
    );
  }
}
