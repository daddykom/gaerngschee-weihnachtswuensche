import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { OrderItemFormValue } from '../../../../shared/models/order.model';
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
  readonly isNew = this.route.snapshot.routeConfig?.path === 'wunsch/neu';
  readonly formModel = signal<OrderItemFormValue>({
    id: this.itemId,
    category: null,
    description: '',
    reason: '',
  });
  readonly itemForm = form(this.formModel, (schema) => {
    required(schema.category);
    required(schema.description);
    maxLength(schema.description, 2000);
    required(schema.reason);
    maxLength(schema.reason, 2000);
  });

  private readonly otherItems: OrderItemFormValue[];
  private initialized = false;

  constructor() {
    const item = this.orderFormState().items.find((candidate) => candidate.id === this.itemId);
    this.otherItems = this.orderFormState().items.filter(
      (candidate) => candidate.id !== this.itemId,
    );
    if (item) {
      this.formModel.set({ ...item });
    } else if (!this.isNew) {
      void this.router.navigate(['/bestellung']);
      return;
    } else {
      this.store.dispatch(
        OrderActions.formChanged({
          changes: { items: [...this.orderFormState().items, this.formModel()] },
        }),
      );
    }

    this.initialized = true;
    effect(() => {
      const itemValue = this.formModel();
      if (!this.initialized) {
        return;
      }
      this.store.dispatch(
        OrderActions.formChanged({ changes: { items: [...this.otherItems, { ...itemValue }] } }),
      );
    });
  }

  save(): void {
    if (!this.itemForm().valid()) {
      this.itemForm().markAsTouched();
      return;
    }

    this.store.dispatch(
      OrderActions.formChanged({
        changes: { items: [...this.otherItems, { ...this.formModel() }] },
      }),
    );
    void this.router.navigate(['/bestellung']);
  }

  back(): void {
    if (this.isNew) {
      this.store.dispatch(
        OrderActions.formChanged({
          changes: { items: this.otherItems },
        }),
      );
    }
    void this.router.navigate(['/bestellung']);
  }
}
