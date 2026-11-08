import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import {
  AdminOrder,
  AdminOrderFormValue,
  AdminOrderItem,
} from '../../../../shared/models/admin-order.model';
import { OrderItemCategory, OrderItemPersonType } from '../../../../shared/models/order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminOrders,
  selectAdminOrdersForm,
} from '../../../../store/admin-orders/admin-orders.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';

interface ItemFormValue {
  category: OrderItemCategory;
  personType: OrderItemPersonType | null;
  personIndex: number | null;
  currentTitle: string;
  currentDescription: string;
  giftLink: string;
  personalMessage: string;
  adminNotes: string;
}

@Component({
  selector: 'app-admin-order-item-edit',
  imports: [
    TranslatePipe,
    FormField,
    ControlErrorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './admin-order-item-edit.component.html',
  styleUrl: './admin-order-item-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderItemEditComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  readonly orders = this.store.selectSignal(selectAdminOrders);
  readonly storeForm = this.store.selectSignal(selectAdminOrdersForm);
  readonly order = signal<AdminOrder | null>(null);
  readonly item = signal<AdminOrderItem | null>(null);
  readonly decision = signal<'accept' | 'reject' | null>(null);
  readonly formModel = signal<ItemFormValue>({
    category: 'gift',
    personType: null,
    personIndex: null,
    currentTitle: '',
    currentDescription: '',
    giftLink: '',
    personalMessage: '',
    adminNotes: '',
  });
  private previousItem: ItemFormValue | null = null;
  readonly itemForm = form(this.formModel, (schema) => {
    required(schema.category);
    required(schema.currentDescription);
    validate(schema.adminNotes, ({ valueOf }) =>
      this.decision() === 'reject' && valueOf(schema.adminNotes).trim() === ''
        ? { kind: 'required' }
        : undefined,
    );
  });
  readonly personOptions = computed(() => [
    ...this.persons('adult', this.order()?.adultsCount ?? 0),
    ...this.persons('child', this.order()?.childrenCount ?? 0),
  ]);

  cancel(): void {
    this.store.dispatch(NavigationActions.navigate({ target: 'back' }));
  }

  constructor() {
    effect(() => {
      const orderId = this.route.snapshot.paramMap.get('orderId');
      const itemId = this.route.snapshot.paramMap.get('itemId');
      const currentOrder = this.orders().find((order) => order.id === orderId);
      const currentItem = currentOrder?.items.find((item) => item.id === itemId);
      if (currentOrder !== undefined && currentItem !== undefined && this.item() === null) {
        this.order.set(currentOrder);
        this.item.set(currentItem);
        const formValue: ItemFormValue = {
          category: currentItem.category,
          personType: currentItem.personType ?? null,
          personIndex: currentItem.personIndex ?? null,
          currentTitle: currentItem.currentTitle ?? currentItem.currentDescription,
          currentDescription: currentItem.currentDescription,
          giftLink: currentItem.giftLink ?? '',
          personalMessage: currentItem.personalMessage ?? currentItem.currentReason ?? '',
          adminNotes: currentItem.adminNotes ?? '',
        };
        this.formModel.set(formValue);
        this.previousItem = { ...formValue };
        const orderForm: AdminOrderFormValue = {
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
          })),
        };
        this.store.dispatch(
          AdminOrdersActions.formLoaded({ orderId: currentOrder.id, form: orderForm }),
        );
      }
    });

    effect(() => {
      const currentItem = this.formModel();
      const orderId = this.order()?.id;
      const itemId = this.item()?.id;
      const changes = this.itemChanges(this.previousItem, currentItem);
      if (orderId !== undefined && itemId !== undefined && Object.keys(changes).length > 0) {
        const currentForm = this.storeForm();
        if (currentForm !== undefined && currentForm !== null) {
          this.store.dispatch(
            AdminOrdersActions.formChanged({
              orderId,
              changes: {
                items: currentForm.items.map((item) =>
                  item.id === itemId ? { ...item, ...changes } : item,
                ),
              },
            }),
          );
        }
        this.previousItem = { ...currentItem };
      }
    });
  }

  accept(): void {
    this.decision.set('accept');
    this.save('approved');
  }

  reject(): void {
    this.decision.set('reject');
    if (!this.itemForm().valid()) {
      this.itemForm().markAsTouched();
      return;
    }
    this.save('rejected');
  }

  private save(status: 'approved' | 'rejected'): void {
    const order = this.order();
    const item = this.item();
    const model = this.formModel();
    if (order === null || item === null || !this.itemForm().valid()) {
      this.itemForm().markAsTouched();
      return;
    }
    this.store.dispatch(
      AdminOrdersActions.draftChanged({
        order: {
          ...order,
          status: status === 'rejected' ? 'changes_requested' : order.status,
          items: order.items.map((current) =>
            current.id === item.id
              ? { ...current, ...model, publicationStatus: status }
              : { ...current },
          ),
        },
      }),
    );
    this.store.dispatch(NavigationActions.navigate({ target: 'back' }));
  }

  private itemChanges(
    previous: ItemFormValue | null,
    current: ItemFormValue,
  ): Partial<ItemFormValue> {
    if (previous === null) {
      return {};
    }
    const changes: Partial<ItemFormValue> = {};
    if (previous.category !== current.category) {
      changes.category = current.category;
    }
    if (previous.personType !== current.personType) {
      changes.personType = current.personType;
    }
    if (previous.personIndex !== current.personIndex) {
      changes.personIndex = current.personIndex;
    }
    if (previous.currentDescription !== current.currentDescription) {
      changes.currentDescription = current.currentDescription;
    }
    if (previous.currentTitle !== current.currentTitle) {
      changes.currentTitle = current.currentTitle;
    }
    if (previous.giftLink !== current.giftLink) {
      changes.giftLink = current.giftLink;
    }
    if (previous.personalMessage !== current.personalMessage) {
      changes.personalMessage = current.personalMessage;
    }
    if (previous.adminNotes !== current.adminNotes) {
      changes.adminNotes = current.adminNotes;
    }
    return changes;
  }

  private persons(
    type: OrderItemPersonType,
    count: number,
  ): Array<{ value: string; type: OrderItemPersonType; index: number }> {
    return Array.from({ length: count }, (_, offset) => ({
      value: `${type}:${offset + 1}`,
      type,
      index: offset + 1,
    }));
  }
}
