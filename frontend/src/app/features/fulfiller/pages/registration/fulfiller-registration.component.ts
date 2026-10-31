import { Component, effect, inject, signal, untracked } from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { FulfillerRegistrationActions } from '../../../../store/fulfiller-registration/fulfiller-registration.actions';
import { selectFulfillerRegistrationForm } from '../../../../store/fulfiller-registration/fulfiller-registration.feature';

@Component({
  selector: 'app-fulfiller-registration',
  imports: [
    ControlErrorComponent,
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './fulfiller-registration.component.html',
  styleUrl: './fulfiller-registration.component.scss',
})
export class FulfillerRegistrationComponent {
  private readonly store = inject(Store);
  private readonly storeForm = this.store.selectSignal(selectFulfillerRegistrationForm);
  readonly model = signal({ email: '', privacyAccepted: false });
  readonly form = form(this.model, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
    required(schema.privacyAccepted);
  });

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
        this.store.dispatch(FulfillerRegistrationActions.formChanged({ changes: current }));
        previous = current;
      }
    });
  }

  submit(): void {
    this.form.email().markAsTouched();
    this.form.privacyAccepted().markAsTouched();
    if (!this.form().valid()) return;
    const value = untracked(this.model);
    this.store.dispatch(FulfillerRegistrationActions.submit({ ...value, language: 'de' }));
  }
}
