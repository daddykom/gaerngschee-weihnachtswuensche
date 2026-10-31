import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { InfoBoxComponent } from '../../../../shared/components/info-box/info-box';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { FulfillerWish } from '../../../../shared/models/fulfiller-order.model';
import { selectFrontendPublicConfigs } from '../../../../store/frontend-config/frontend-config.feature';
import { FulfillerOrdersActions } from '../../../../store/fulfiller-orders/fulfiller-orders.actions';
import {
  selectFulfillerReservationErrorCode,
  selectFulfillerReservationForm,
  selectFulfillerReservationStatus,
} from '../../../../store/fulfiller-orders/fulfiller-orders.feature';

@Component({
  selector: 'app-fulfiller-reservation-dialog',
  imports: [
    ControlErrorComponent,
    FormField,
    InfoBoxComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './fulfiller-reservation-dialog.html',
  styleUrl: './fulfiller-reservation-dialog.scss',
})
export class FulfillerReservationDialog {
  private readonly store = inject(Store);
  private readonly dialogRef = inject(MatDialogRef<FulfillerReservationDialog>);
  readonly wish = inject<FulfillerWish>(MAT_DIALOG_DATA);
  private readonly storeForm = this.store.selectSignal(selectFulfillerReservationForm);
  private readonly publicConfigs = this.store.selectSignal(selectFrontendPublicConfigs);
  readonly status = this.store.selectSignal(selectFulfillerReservationStatus);
  readonly errorCode = this.store.selectSignal(selectFulfillerReservationErrorCode);
  readonly model = signal({ email: '', privacyAccepted: false });
  readonly form = form(this.model, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
    required(schema.privacyAccepted);
  });
  readonly handoverDate = computed(() => this.configValue('fulfiller_handover_date'));
  readonly handoverTime = computed(() => this.configValue('fulfiller_handover_time'));
  readonly handoverLocation = computed(() => this.configValue('fulfiller_handover_location'));

  constructor() {
    let initialized = false;
    let previous = this.model();
    effect(() => {
      const stored = this.storeForm();
      if (!initialized) {
        this.model.set({ email: stored.email, privacyAccepted: stored.privacyAccepted });
        previous = this.model();
        initialized = true;
      }
    });
    effect(() => {
      if (!initialized) return;
      const current = this.model();
      if (
        current.email !== previous.email ||
        current.privacyAccepted !== previous.privacyAccepted
      ) {
        this.store.dispatch(FulfillerOrdersActions.reservationFormChanged({ changes: current }));
        previous = current;
      }
    });
    effect(() => {
      if (this.status() === 'success') {
        this.dialogRef.close();
      }
    });
  }

  submit(): void {
    this.form.email().markAsTouched();
    this.form.privacyAccepted().markAsTouched();
    if (!this.form().valid() || this.status() === 'loading') return;

    untracked(() => this.store.dispatch(FulfillerOrdersActions.reservationSubmitted()));
  }

  private configValue(variableName: string): string {
    const config = this.publicConfigs().find(
      (candidate) => candidate.variableName === variableName,
    );
    return typeof config?.value === 'string' ? config.value : '';
  }
}
