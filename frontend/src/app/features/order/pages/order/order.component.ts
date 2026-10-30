import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  applyWhen,
  form,
  FormField,
  maxLength,
  min,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import {
  OrderFormValue,
  OrderItemStatus,
  OrderStatus,
} from '../../../../shared/models/order.model';
import { selectAuthFirstAccess } from '../../../../store/auth/auth.feature';
import { NotificationActions } from '../../../../store/notification/notification.actions';
import { OrderActions } from '../../../../store/order/order.actions';
import {
  selectOrder,
  selectOrderAdultsCount,
  selectOrderChildrenCount,
  selectOrderFairgateUserExists,
  selectOrderForm,
  selectOrderSaveStatus,
  selectOrderStatus,
} from '../../../../store/order/order.feature';

@Component({
  selector: 'app-order',
  imports: [
    TranslatePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ControlErrorComponent,
  ],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly status = this.store.selectSignal(selectOrderStatus);
  readonly saving = this.store.selectSignal(selectOrderSaveStatus);
  readonly order = this.store.selectSignal(selectOrder);
  readonly fairgateUserExists = this.store.selectSignal(selectOrderFairgateUserExists);
  readonly fairgateAdultsCount = this.store.selectSignal(selectOrderAdultsCount);
  readonly fairgateChildrenCount = this.store.selectSignal(selectOrderChildrenCount);
  readonly firstAccess = this.store.selectSignal(selectAuthFirstAccess);
  readonly storeForm = this.store.selectSignal(selectOrderForm);
  readonly canEdit = computed(() => {
    const currentOrder = this.order();
    return (
      currentOrder === null ||
      ['draft', 'family_size_exceeded', 'changes_requested'].includes(
        currentOrder.status as OrderStatus,
      )
    );
  });
  readonly maxItems = computed(() => {
    const adults =
      this.fairgateUserExists() === true
        ? this.fairgateAdultsCount()
        : this.storeForm().adultsCount;
    const children =
      this.fairgateUserExists() === true
        ? this.fairgateChildrenCount()
        : this.storeForm().childrenCount;
    return (adults ?? 0) + (children ?? 0);
  });
  readonly canAddItem = computed(
    () => this.canEdit() && this.storeForm().items.length < this.maxItems(),
  );

  readonly formModel = signal<OrderFormValue>({
    password: '',
    passwordConfirmation: '',
    adultsCount: null,
    childrenCount: null,
    text: '',
    items: [],
  });

  readonly orderForm = form(this.formModel, (schema) => {
    applyWhen(
      schema,
      () => this.firstAccess(),
      (passwordSchema) => {
        required(passwordSchema.password);
        minLength(passwordSchema.password, 12);
        maxLength(passwordSchema.password, 128);
        required(passwordSchema.passwordConfirmation);
        minLength(passwordSchema.passwordConfirmation, 12);
        maxLength(passwordSchema.passwordConfirmation, 128);
        validate(passwordSchema.passwordConfirmation, ({ valueOf }) =>
          valueOf(passwordSchema.password) === valueOf(passwordSchema.passwordConfirmation)
            ? undefined
            : { kind: 'passwordsDoNotMatch' },
        );
      },
    );
    required(schema.adultsCount);
    min(schema.adultsCount, 0);
    required(schema.childrenCount);
    min(schema.childrenCount, 0);
    required(schema.text);
    maxLength(schema.text, 2000);
  });

  constructor() {
    let initialized = false;
    effect(() => {
      const status = this.status();
      if (status === 'loaded' && !initialized) {
        this.formModel.set(this.cloneFormValue(this.storeForm()));
        initialized = true;
      }
    });

    effect(() => {
      if (initialized) {
        this.store.dispatch(
          OrderActions.formChanged({ changes: this.cloneFormValue(this.formModel()) }),
        );
      }
    });
  }

  markTouched(): void {
    this.orderForm().markAsTouched();
  }

  save(): void {
    const itemCount = this.storeForm().items.length;
    if (itemCount < 1 || itemCount > this.maxItems()) {
      this.store.dispatch(
        NotificationActions.show({
          variant: 'error',
          titleKey: 'app.order.errors.INVALID_ORDER',
          messageKey: 'app.order.errors.items.itemCount',
          preserveOnRoutes: ['/bestellung'],
        }),
      );
    }

    if (!this.orderForm().valid()) {
      this.markTouched();
      return;
    }

    if (itemCount < 1 || itemCount > this.maxItems()) {
      return;
    }

    if (this.canEdit() && this.saving() !== 'loading') {
      this.store.dispatch(OrderActions.save({ form: this.formModel() }));
    }
  }

  addItem(): void {
    if (!this.canAddItem()) {
      return;
    }
    void this.router.navigate(['/bestellung/wunsch/neu']);
  }

  removeItem(id: string): void {
    const items = this.formModel().items;
    if (!this.canEdit() || items.length <= 1) {
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'app.order.items.deleteTitle',
        message: 'app.order.items.deleteMessage',
        confirmLabel: 'app.order.items.deleteConfirm',
        cancelLabel: 'app.order.items.cancel',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.store.dispatch(
          OrderActions.formChanged({
            changes: { items: this.storeForm().items.filter((item) => item.id !== id) },
          }),
        );
      }
    });
  }

  editItem(id: string): void {
    void this.router.navigate(['/bestellung/wunsch', id]);
  }

  itemStatus(id: string): OrderItemStatus {
    return this.order()?.items.find((item) => item.id === id)?.status ?? 'draft';
  }

  private cloneFormValue(value: OrderFormValue): OrderFormValue {
    return {
      ...value,
      items: value.items.map((item) => ({ ...item })),
    };
  }
}
