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
import { AdminOrder, AdminOrderFormValue } from '../../../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrders,
  selectAdminOrdersForm,
  selectAdminOrdersSaveStatus,
} from '../../../../store/admin-orders/admin-orders.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';

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
  readonly storeForm = this.store.selectSignal(selectAdminOrdersForm);
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
    let initialized = false;
    let previousForm: AdminOrderFormValue | null = null;
    effect(() => {
      const id = this.route.snapshot.paramMap.get('orderId');
      const currentOrder = this.orders().find((order) => order.id === id);
      if (currentOrder !== undefined && this.order() === null) {
        const rejectItem = this.route.snapshot.queryParamMap.get('rejectItem');
        this.order.set(currentOrder);
        const formValue: AdminOrderFormValue = {
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
        };
        this.formModel.set(this.cloneForm(formValue));
        previousForm = this.cloneForm(formValue);
        initialized = true;
        this.store.dispatch(
          AdminOrdersActions.formLoaded({ orderId: currentOrder.id, form: formValue }),
        );
      }
    });

    effect(() => {
      const currentForm = this.storeForm();
      if (currentForm != null && !initialized) {
        this.formModel.set(this.cloneForm(currentForm));
        previousForm = this.cloneForm(currentForm);
        initialized = true;
      }
    });

    effect(() => {
      if (!initialized) {
        return;
      }
      const orderId = this.order()?.id;
      const currentForm = this.formModel();
      const changes = this.formChanges(previousForm, currentForm);
      if (orderId !== undefined && Object.keys(changes).length > 0) {
        this.store.dispatch(AdminOrdersActions.formChanged({ orderId, changes }));
        previousForm = this.cloneForm(currentForm);
      }
    });
  }

  save(): void {
    const order = this.order();
    this.syncForm();
    const model = this.storeForm() ?? this.formModel();
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
    this.syncForm();
    const model = this.storeForm() ?? this.formModel();
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
    this.syncForm();
    const model = this.storeForm() ?? this.formModel();
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

  private syncForm(): void {
    const orderId = this.order()?.id;
    const currentForm = this.formModel();
    const changes = this.formChanges(this.storeForm(), currentForm);
    if (orderId !== undefined && Object.keys(changes).length > 0) {
      this.store.dispatch(AdminOrdersActions.formChanged({ orderId, changes }));
    }
  }

  private cloneForm(value: AdminOrderFormValue): AdminOrderFormValue {
    return {
      ...value,
      items: value.items.map((item) => ({ ...item })),
    };
  }

  private formChanges(
    previous: AdminOrderFormValue | null,
    current: AdminOrderFormValue,
  ): Partial<AdminOrderFormValue> {
    if (previous == null) {
      return {};
    }
    const changes: Partial<AdminOrderFormValue> = {};
    if (previous.currentText !== current.currentText) changes.currentText = current.currentText;
    if (previous.adminNotes !== current.adminNotes) changes.adminNotes = current.adminNotes;
    if (previous.adultsCount !== current.adultsCount) changes.adultsCount = current.adultsCount;
    if (previous.childrenCount !== current.childrenCount)
      changes.childrenCount = current.childrenCount;
    if (JSON.stringify(previous.items) !== JSON.stringify(current.items)) {
      changes.items = current.items.map((item) => ({ ...item }));
    }
    return changes;
  }
}
