import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { AuthActions } from '../../../../store/auth/auth.actions';
import {
  selectAuthEmail,
  selectAuthPasswordChangeLoading,
} from '../../../../store/auth/auth.feature';

@Component({
  selector: 'app-password-change',
  imports: [MatInputModule, MatButtonModule, FormField, TranslatePipe, ControlErrorComponent],
  templateUrl: './password-change.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './password-change.component.scss',
})
export class PasswordChange {
  private readonly store = inject(Store);
  readonly submitting = this.store.selectSignal(selectAuthPasswordChangeLoading);
  readonly email = this.store.selectSignal(selectAuthEmail);

  readonly passwordChangeModel = signal({ newPassword: '', passwordConfirmation: '' });
  readonly passwordChangeForm = form(this.passwordChangeModel, (schema) => {
    required(schema.newPassword);
    minLength(schema.newPassword, inputLimits.minimumPasswordLength);
    maxLength(schema.newPassword, inputLimits.password);
    required(schema.passwordConfirmation);
    minLength(schema.passwordConfirmation, inputLimits.minimumPasswordLength);
    maxLength(schema.passwordConfirmation, inputLimits.password);
    validate(schema.passwordConfirmation, ({ valueOf }) =>
      valueOf(schema.newPassword) === valueOf(schema.passwordConfirmation)
        ? undefined
        : { kind: 'passwordsDoNotMatch' },
    );
  });
  onSubmit(): void {
    if (!this.passwordChangeForm().valid()) {
      this.passwordChangeForm().markAsTouched();
      this.passwordChangeForm.newPassword().markAsTouched();
      this.passwordChangeForm.passwordConfirmation().markAsTouched();
      return;
    }

    this.store.dispatch(
      AuthActions.passwordChange({ password: this.passwordChangeModel().newPassword }),
    );
  }
}
