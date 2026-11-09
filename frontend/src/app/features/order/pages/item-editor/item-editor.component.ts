import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { OrderItemFormValue, OrderItemPersonType } from '../../../../shared/models/order.model';
import { OrderActions } from '../../../../store/order/order.actions';
import { selectOrderForm } from '../../../../store/order/order.feature';

@Component({
  selector: 'app-item-editor',
  imports: [
    TranslatePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ControlErrorComponent,
  ],
  templateUrl: './item-editor.component.html',
  styleUrl: './item-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemEditorComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly orderFormState = this.store.selectSignal(selectOrderForm);
  private readonly itemId = this.route.snapshot.paramMap.get('itemId') ?? crypto.randomUUID();
  readonly personOptions = computed(() => {
    const currentForm = this.orderFormState();
    const current = currentForm.items.find((item) => item.id === this.itemId);
    const assigned = new Set(
      currentForm.items
        .filter(
          (item) =>
            item.id !== this.itemId && item.personType !== null && item.personIndex !== null,
        )
        .map((item) => `${item.personType}:${item.personIndex}`),
    );
    return [
      ...this.persons('adult', currentForm.adultsCount ?? 0),
      ...this.persons('child', currentForm.childrenCount ?? 0),
    ].filter(
      (option) =>
        !assigned.has(option.value) ||
        option.value === `${current?.personType}:${current?.personIndex}`,
    );
  });
  readonly isNew = this.route.snapshot.routeConfig?.path === 'wunsch/neu';
  readonly formModel = signal<OrderItemFormValue>({
    id: this.itemId,
    category: null,
    personType: null,
    personIndex: null,
    title: '',
    description: '',
    giftLink: '',
    personalMessage: '',
  });
  readonly itemForm = form(this.formModel, (schema) => {
    required(schema.category);
    validate(schema.personType, ({ valueOf }) =>
      this.requiresPersonAssignment() &&
      (valueOf(schema.personIndex) === null || valueOf(schema.personType) === null)
        ? { kind: 'required' }
        : undefined,
    );
    validate(schema.personIndex, ({ valueOf }) =>
      this.requiresPersonAssignment() &&
      (valueOf(schema.personType) === null || valueOf(schema.personIndex) === null)
        ? { kind: 'required' }
        : undefined,
    );
    validate(schema.title, ({ valueOf }) =>
      valueOf(schema.title).trim() === '' ? { kind: 'required' } : undefined,
    );
    maxLength(schema.title, 255);
    validate(schema.description, ({ valueOf }) =>
      valueOf(schema.description).trim() === '' ? { kind: 'required' } : undefined,
    );
    maxLength(schema.description, 2000);
    maxLength(schema.giftLink, 2048);
    maxLength(schema.personalMessage, 2000);
  });

  private initialized = false;
  private previousItem: OrderItemFormValue | null = null;

  constructor() {
    const item = this.orderFormState().items.find((candidate) => candidate.id === this.itemId);
    if (item) {
      this.formModel.set({ ...item });
      this.previousItem = { ...item };
    } else if (!this.isNew) {
      void this.router.navigate(['/bestellung']);
      return;
    } else {
      const newItem = this.formModel();
      this.store.dispatch(
        OrderActions.formChanged({
          changes: { items: [...this.orderFormState().items, newItem] },
        }),
      );
      this.previousItem = { ...newItem };
    }

    this.initialized = true;
    effect(() => {
      const itemValue = this.formModel();
      if (!this.initialized) {
        return;
      }
      const changes = this.itemChanges(this.previousItem, itemValue);
      if (Object.keys(changes).length > 0) {
        this.store.dispatch(OrderActions.itemFormChanged({ itemId: this.itemId, changes }));
        this.previousItem = { ...itemValue };
      }
    });
  }

  save(): void {
    if (!this.itemForm().valid()) {
      this.itemForm().markAsTouched();
      return;
    }

    this.syncItem();
    void this.router.navigate(['/bestellung']);
  }

  back(): void {
    if (this.isNew) {
      this.store.dispatch(
        OrderActions.formChanged({
          changes: {
            items: this.orderFormState().items.filter((item) => item.id !== this.itemId),
          },
        }),
      );
    }
    void this.router.navigate(['/bestellung']);
  }

  private syncItem(): void {
    const currentItem = this.formModel();
    const changes = this.itemChanges(this.previousItem, currentItem);
    if (Object.keys(changes).length > 0) {
      this.store.dispatch(OrderActions.itemFormChanged({ itemId: this.itemId, changes }));
      this.previousItem = { ...currentItem };
    }
  }

  private itemChanges(
    previous: OrderItemFormValue | null,
    current: OrderItemFormValue,
  ): Partial<OrderItemFormValue> {
    if (previous === null) {
      return {};
    }

    const changes: Partial<OrderItemFormValue> = {};
    if (previous.category !== current.category) {
      changes.category = current.category;
    }
    if (previous.personType !== current.personType) {
      changes.personType = current.personType;
    }
    if (previous.personIndex !== current.personIndex) {
      changes.personIndex = current.personIndex;
    }
    if (previous.title !== current.title) {
      changes.title = current.title;
    }
    if (previous.description !== current.description) {
      changes.description = current.description;
    }
    if (previous.giftLink !== current.giftLink) {
      changes.giftLink = current.giftLink;
    }
    if (previous.personalMessage !== current.personalMessage) {
      changes.personalMessage = current.personalMessage;
    }
    return changes;
  }

  personLabel(type: OrderItemPersonType, index: number): string {
    return `${type === 'adult' ? 'Erwachsener' : 'Kind'} ${index}`;
  }

  private persons(
    type: OrderItemPersonType,
    count: number,
  ): Array<{ value: string; type: OrderItemPersonType; index: number; label: string }> {
    return Array.from({ length: count }, (_, offset) => {
      const index = offset + 1;
      return { value: `${type}:${index}`, type, index, label: this.personLabel(type, index) };
    });
  }

  private requiresPersonAssignment(): boolean {
    if (this.isNew) {
      return true;
    }
    const item = this.orderFormState().items.find((candidate) => candidate.id === this.itemId);
    return item?.personType !== null && item?.personType !== undefined;
  }
}
