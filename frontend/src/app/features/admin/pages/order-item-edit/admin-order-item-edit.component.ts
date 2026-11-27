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
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import {
  AdminOrder,
  AdminOrderFormValue,
  AdminOrderItem,
  AdminPublicationStatus,
} from '../../../../shared/models/admin-order.model';
import { imageChangeError } from '../../../../shared/models/order-item-image-validation';
import { OrderItemImageChange } from '../../../../shared/models/order-item-image.model';
import { OrderItemCategory, OrderItemPersonType } from '../../../../shared/models/order.model';
import { AdminOrdersActions } from '../../../../store/admin-orders/admin-orders.actions';
import {
  selectAdminItemImage,
  selectAdminOrders,
  selectAdminOrdersActiveOrderId,
  selectAdminOrdersForm,
} from '../../../../store/admin-orders/admin-orders.feature';
import { selectImageTransfers } from '../../../../store/image-transfers/image-transfers.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';
import { NotificationActions } from '../../../../store/notification/notification.actions';
import { OrderItemImageEditorComponent } from './order-item-image-editor/order-item-image-editor.component';

interface ItemFormValue {
  imageChange: OrderItemImageChange | null;
  category: OrderItemCategory;
  personType: OrderItemPersonType | null;
  personIndex: number | null;
  currentTitle: string;
  currentDescription: string;
  giftLink: string;
  personalMessage: string;
  adminNotes: string;
  publicationStatus: AdminPublicationStatus;
}

@Component({
  selector: 'app-admin-order-item-edit',
  imports: [
    OrderItemImageEditorComponent,
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
  private readonly dialog = inject(MatDialog);
  readonly removalPlanned = computed(
    () =>
      !!this.storeForm()?.items.find((candidate) => candidate.id === this.item()?.id)
        ?.fulfillerRemoval,
  );
  readonly canRemoveFulfiller = computed(() => {
    const item = this.item();
    return (
      !!item?.fulfillerEmail &&
      !this.removalPlanned() &&
      !item.receivedAt &&
      ['pending_confirmation', 'reserved'].includes(item.fulfillmentStatus)
    );
  });
  readonly imageRequest = this.store.selectSignal(selectAdminItemImage);
  private readonly transfers = this.store.selectSignal(selectImageTransfers);
  readonly imageBusy = computed(() =>
    (this.transfers() ?? []).some(
      (job) =>
        job.orderId === this.order()?.id &&
        job.itemId === this.item()?.id &&
        (job.status === 'queued' || job.status === 'uploading'),
    ),
  );
  readonly orders = this.store.selectSignal(selectAdminOrders);
  readonly storeForm = this.store.selectSignal(selectAdminOrdersForm);
  private readonly activeOrderId = this.store.selectSignal(selectAdminOrdersActiveOrderId);
  readonly order = signal<AdminOrder | null>(null);
  readonly item = signal<AdminOrderItem | null>(null);
  readonly publicationStatusOptions: AdminPublicationStatus[] = [
    'submitted',
    'approved',
    'rejected',
  ];
  readonly formModel = signal<ItemFormValue>({
    imageChange: null,
    category: 'gift',
    personType: null,
    personIndex: null,
    currentTitle: '',
    currentDescription: '',
    giftLink: '',
    personalMessage: '',
    adminNotes: '',
    publicationStatus: 'submitted',
  });
  private previousItem: ItemFormValue | null = null;
  readonly itemForm = form(this.formModel, (schema) => {
    validate(schema.imageChange, ({ value }) => {
      const kind = imageChangeError(value());
      return kind ? { kind } : null;
    });
    required(schema.category);
    required(schema.currentDescription);
    validate(schema.adminNotes, ({ valueOf }) =>
      valueOf(schema.publicationStatus) === 'rejected' && valueOf(schema.adminNotes).trim() === ''
        ? { kind: 'required' }
        : undefined,
    );
  });
  readonly personOptions = computed(() => {
    const currentForm = this.activeOrderId() === this.order()?.id ? this.storeForm() : null;
    return [
      ...this.persons('adult', currentForm?.adultsCount ?? this.order()?.adultsCount ?? 0),
      ...this.persons('child', currentForm?.childrenCount ?? this.order()?.childrenCount ?? 0),
    ];
  });

  cancel(): void {
    this.store.dispatch(NavigationActions.navigate({ target: 'back' }));
  }

  removeFulfiller(): void {
    const item = this.item();
    const order = this.order();
    if (!item || !order || !this.canRemoveFulfiller()) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'app.admin.fulfillerRemoval.title',
          message: 'app.admin.fulfillerRemoval.confirmation',
          messageParams: { email: item.fulfillerEmail ?? '' },
          confirmLabel: 'app.admin.fulfillerRemoval.yes',
          cancelLabel: 'app.admin.fulfillerRemoval.no',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        const form = this.storeForm();
        if (confirmed !== true || !form || this.activeOrderId() !== order.id) return;
        this.syncItem();
        this.store.dispatch(
          AdminOrdersActions.formChanged({
            orderId: order.id,
            changes: {
              items: this.storeForm()!.items.map((current) =>
                current.id !== item.id
                  ? current
                  : {
                      ...current,
                      fulfillerRemoval: {
                        fulfillerEmail: item.fulfillerEmail ?? null,
                        fulfillmentStatus: item.fulfillmentStatus,
                        reservedAt: item.reservedAt ?? null,
                        reservationExpiresAt: item.reservationExpiresAt ?? null,
                      },
                    },
              ),
            },
          }),
        );
        this.store.dispatch(
          NotificationActions.show({
            variant: 'info',
            titleKey: 'app.admin.fulfillerRemoval.title',
            messageKey: 'app.admin.fulfillerRemoval.pending',
            preserveOnRoutes: [
              `/admin/orders/${order.id}/edit`,
              `/admin/orders/${order.id}/edit/item/${item.id}`,
            ],
          }),
        );
      });
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
        const existingForm = this.activeOrderId() === currentOrder.id ? this.storeForm() : null;
        const formItem = existingForm?.items.find((item) => item.id === itemId);
        const editableItem = formItem ?? currentItem;
        const formValue: ItemFormValue = {
          imageChange: formItem?.imageChange ?? null,
          category: editableItem.category,
          personType: editableItem.personType ?? null,
          personIndex: editableItem.personIndex ?? null,
          currentTitle: editableItem.currentTitle ?? editableItem.currentDescription,
          currentDescription: editableItem.currentDescription,
          giftLink: editableItem.giftLink ?? '',
          personalMessage: editableItem.personalMessage ?? editableItem.currentReason ?? '',
          adminNotes: editableItem.adminNotes ?? '',
          publicationStatus: editableItem.publicationStatus,
        };
        this.formModel.set(formValue);
        if (formValue.imageChange) this.itemForm.imageChange().markAsTouched();
        this.previousItem = { ...formValue };
        if (!existingForm) {
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
      } else if (currentOrder !== undefined && currentItem !== undefined) {
        this.order.set(currentOrder);
        this.item.set(currentItem);
      }
    });

    effect(() => this.syncItem());
  }

  save(): void {
    const order = this.order();
    const item = this.item();
    const model = this.formModel();
    if (order === null || item === null || !this.itemForm().valid()) {
      this.itemForm().markAsTouched();
      if (this.itemForm.imageChange().invalid()) {
        document.querySelector<HTMLElement>('app-order-item-image-editor button')?.focus();
        document.querySelector('app-order-item-image-editor')?.scrollIntoView({ block: 'center' });
      }
      return;
    }
    this.syncItem();
    this.store.dispatch(NavigationActions.navigate({ target: 'back' }));
  }

  private syncItem(): void {
    const currentItem = this.formModel();
    const orderId = this.order()?.id;
    const itemId = this.item()?.id;
    const currentForm = this.storeForm();
    const changes = this.itemChanges(this.previousItem, currentItem);
    if (
      !currentForm ||
      orderId === undefined ||
      itemId === undefined ||
      this.activeOrderId() !== orderId ||
      Object.keys(changes).length === 0
    ) {
      return;
    }
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
    this.previousItem = { ...currentItem };
  }

  private itemChanges(
    previous: ItemFormValue | null,
    current: ItemFormValue,
  ): Partial<ItemFormValue> {
    if (previous === null) {
      return {};
    }
    const changes: Partial<ItemFormValue> = {};
    if (previous.imageChange !== current.imageChange) changes.imageChange = current.imageChange;
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
    if (previous.publicationStatus !== current.publicationStatus) {
      changes.publicationStatus = current.publicationStatus;
    }
    return changes;
  }

  reloadImage(): void {
    const orderId = this.order()?.id;
    const itemId = this.item()?.id;
    if (orderId && itemId) {
      this.store.dispatch(NotificationActions.clear());
      this.store.dispatch(AdminOrdersActions.imageReloadClicked({ orderId, itemId }));
    }
  }

  selectImage(file: File): void {
    const request = this.imageRequest();
    if (request?.status !== 'loaded' || this.imageBusy()) return;
    this.formModel.update((model) => ({
      ...model,
      imageChange: {
        operation: 'replace',
        revision: model.imageChange?.revision ?? request.data.revision,
        file,
      },
    }));
    this.itemForm.imageChange().markAsTouched();
    this.syncItem();
  }

  removeImage(): void {
    const request = this.imageRequest();
    if (request?.status !== 'loaded' || this.imageBusy()) return;
    this.formModel.update((model) => ({
      ...model,
      imageChange: request.data.image
        ? { operation: 'remove', revision: model.imageChange?.revision ?? request.data.revision }
        : null,
    }));
    this.syncItem();
  }

  resetImage(): void {
    if (this.imageBusy()) return;
    this.formModel.update((model) => ({ ...model, imageChange: null }));
    this.syncItem();
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
