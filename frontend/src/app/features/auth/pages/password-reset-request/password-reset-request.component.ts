import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { AuthActions } from '../../../../store/auth/auth.actions';
import {
  selectPasswordResetRequestLoading,
  selectPasswordResetRequestSent,
} from '../../../../store/password-reset/password-reset.feature';

@Component({
  selector: 'app-password-reset-request',
  imports: [MatInputModule, MatButtonModule, FormField, TranslatePipe, ControlErrorComponent],
  templateUrl: './password-reset-request.component.html',
  styleUrl: './password-reset-request.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PasswordResetRequestComponent {
  private readonly store = inject(Store);
  readonly loading = this.store.selectSignal(selectPasswordResetRequestLoading);
  readonly sent = this.store.selectSignal(selectPasswordResetRequestSent);
  readonly model = signal({ email: '' });
  readonly passwordResetRequestForm = form(this.model, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
  });

  onSubmit(): void {
    if (!this.passwordResetRequestForm().valid()) {
      this.passwordResetRequestForm.email().markAsTouched();
      return;
    }

    this.store.dispatch(AuthActions.passwordResetRequest({ email: this.model().email }));
  }
}
