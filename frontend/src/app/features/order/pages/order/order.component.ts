import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  min,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { InfoBoxComponent } from '../../../../shared/components/info-box/info-box';
import { OrderFormValue } from '../../../../shared/models/order.model';
import { selectAuthFirstAccess } from '../../../../store/auth/auth.feature';
import { OrderActions } from '../../../../store/order/order.actions';
import {
  selectOrder,
  selectOrderAdultsCount,
  selectOrderChildrenCount,
  selectOrderFairgateUserExists,
  selectOrderForm,
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
    InfoBoxComponent,
    ControlErrorComponent,
  ],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderComponent {
  private readonly store = inject(Store);
  readonly status = this.store.selectSignal(selectOrderStatus);
  readonly order = this.store.selectSignal(selectOrder);
  readonly fairgateUserExists = this.store.selectSignal(selectOrderFairgateUserExists);
  readonly fairgateAdultsCount = this.store.selectSignal(selectOrderAdultsCount);
  readonly fairgateChildrenCount = this.store.selectSignal(selectOrderChildrenCount);
  readonly firstAccess = this.store.selectSignal(selectAuthFirstAccess);
  readonly storeForm = this.store.selectSignal(selectOrderForm);

  readonly formModel = signal<OrderFormValue>({
    password: '',
    passwordConfirmation: '',
    adultsCount: null,
    childrenCount: null,
    text: '',
  });

  readonly orderForm = form(this.formModel, (schema) => {
    required(schema.password);
    minLength(schema.password, 12);
    maxLength(schema.password, 128);
    required(schema.passwordConfirmation);
    minLength(schema.passwordConfirmation, 12);
    maxLength(schema.passwordConfirmation, 128);
    validate(schema.passwordConfirmation, ({ valueOf }) =>
      valueOf(schema.password) === valueOf(schema.passwordConfirmation)
        ? undefined
        : { kind: 'passwordsDoNotMatch' },
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
        this.formModel.set(this.storeForm());
        initialized = true;
      }
    });

    effect(() => {
      if (initialized) {
        this.store.dispatch(OrderActions.formChanged({ changes: this.formModel() }));
      }
    });
  }

  markTouched(): void {
    this.orderForm().markAsTouched();
  }
}
