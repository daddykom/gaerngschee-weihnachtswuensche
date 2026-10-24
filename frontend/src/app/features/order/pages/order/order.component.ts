import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  applyEach,
  applyWhen,
  maxLength,
  min,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { OrderFormValue, OrderItemCategory, OrderStatus } from '../../../../shared/models/order.model';
import { selectAuthFirstAccess } from '../../../../store/auth/auth.feature';
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
    MatExpansionModule,
    MatSelectModule,
    ControlErrorComponent,
  ],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderComponent {
  private readonly store = inject(Store);
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
    return currentOrder === null || ['draft', 'family_size_exceeded', 'changes_requested'].includes(currentOrder.status as OrderStatus);
  });
  readonly maxItems = computed(() => {
    const adults = this.fairgateUserExists() === true ? this.fairgateAdultsCount() : this.storeForm().adultsCount;
    const children = this.fairgateUserExists() === true ? this.fairgateChildrenCount() : this.storeForm().childrenCount;
    return (adults ?? 0) + (children ?? 0);
  });
  readonly canAddItem = computed(() => this.canEdit() && this.storeForm().items.length < this.maxItems());

  readonly formModel = signal<OrderFormValue>({
    password: '',
    passwordConfirmation: '',
    adultsCount: null,
    childrenCount: null,
    text: '',
    items: [],
  });

  readonly orderForm = form(this.formModel, (schema) => {
    applyWhen(schema, () => this.firstAccess(), (passwordSchema) => {
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
    });
    required(schema.adultsCount);
    min(schema.adultsCount, 0);
    required(schema.childrenCount);
    min(schema.childrenCount, 0);
    required(schema.text);
    maxLength(schema.text, 2000);
    applyEach(schema.items, (itemSchema) => {
      required(itemSchema.category);
      required(itemSchema.description);
      maxLength(itemSchema.description, 2000);
      required(itemSchema.reason);
      maxLength(itemSchema.reason, 2000);
    });
    validate(schema.items, ({ valueOf }) => {
      const items = valueOf(schema.items);
      return items.length >= 1 && items.length <= this.maxItems()
        ? undefined
        : { kind: 'itemCount' };
    });
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
        this.store.dispatch(OrderActions.formChanged({ changes: this.cloneFormValue(this.formModel()) }));
      }
    });
  }

  markTouched(): void {
    this.orderForm().markAsTouched();
  }

  save(): void {
    if (!this.orderForm().valid()) {
      this.markTouched();
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
    this.formModel.update((model) => ({
      ...model,
      items: [...model.items, { id: crypto.randomUUID(), category: null, description: '', reason: '' }],
    }));
  }

  removeItem(id: string): void {
    const items = this.formModel().items;
    if (!this.canEdit() || items.length <= 1) {
      return;
    }
    this.formModel.update((model) => ({ ...model, items: model.items.filter((item) => item.id !== id) }));
  }

  itemStatus(id: string): string {
    return this.order()?.items.find((item) => item.id === id)?.status ?? 'draft';
  }

  categoryLabel(category: OrderItemCategory | null): string {
    return category === 'voucher' ? 'app.order.items.categories.voucher' : 'app.order.items.categories.gift';
  }

  private cloneFormValue(value: OrderFormValue): OrderFormValue {
    return {
      ...value,
      items: value.items.map((item) => ({ ...item })),
    };
  }
}
