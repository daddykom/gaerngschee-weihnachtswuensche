import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { form, FormField, min, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import {
  AdminOrder,
  AdminOrderFormStatus,
  AdminOrderFormValue,
} from '../../../../shared/models/admin-order.model';
import { ORDER_STATUS_WORKFLOW } from '../../../../shared/models/order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrders,
  selectAdminOrdersForm,
  selectAdminOrdersSaveStatus,
} from '../../../../store/admin-orders/admin-orders.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';
import { NotificationActions } from '../../../../store/notification/notification.actions';

@Component({
  selector: 'app-admin-order-edit',
  imports: [
    TranslatePipe,
    ControlErrorComponent,
    RouterLink,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
    status: 'draft',
    currentText: '',
    adminNotes: '',
    adultsCount: 0,
    childrenCount: 0,
    items: [],
  });
  readonly orderForm = form(this.formModel, (schema) => {
    required(schema.currentText);
    required(schema.adultsCount);
    min(schema.adultsCount, 0);
    required(schema.childrenCount);
    min(schema.childrenCount, 0);
  });
  readonly statusOptions: AdminOrderFormStatus[] = [
    'unchanged',
    ...ORDER_STATUS_WORKFLOW.slice(0, 5),
  ];

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
          status: currentOrder.status,
          currentText: currentOrder.currentText ?? '',
          adminNotes: currentOrder.adminNotes ?? '',
          adultsCount: currentOrder.adultsCount,
          childrenCount: currentOrder.childrenCount,
          items: currentOrder.items.map((item) => ({
            ...item,
            currentTitle: item.currentTitle ?? item.currentDescription,
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
    const model = this.storeForm() ?? this.formModel();
    if (order === null || !this.orderForm().valid()) {
      this.orderForm().markAsTouched();
      return;
    }
    if (model.items.some((item) => item.currentDescription.trim() === '')) {
      this.store.dispatch(
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.overview.saveErrorTitle',
          messageKey: 'app.admin.overview.errors.ITEM_DESCRIPTION_REQUIRED',
          preserveOnRoutes: ['/admin/overview', '/admin/orders'],
        }),
      );
      return;
    }
    if (
      model.items.some(
        (item) => item.publicationStatus === 'rejected' && item.adminNotes.trim() === '',
      )
    ) {
      this.store.dispatch(
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.admin.overview.saveErrorTitle',
          messageKey: 'app.admin.overview.errors.REJECTION_REASON_REQUIRED',
          preserveOnRoutes: ['/admin/overview', '/admin/orders'],
        }),
      );
      return;
    }
    this.store.dispatch(
      AdminOrdersActions.save({
        order: {
          ...order,
          ...model,
          status: model.status === 'unchanged' ? order.status : model.status,
          items: model.items.map((item) => ({ ...item })),
        },
        action: 'save',
      }),
    );
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
    if (previous.status !== current.status) changes.status = current.status;
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
