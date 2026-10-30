import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
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
  selectAuthPasswordChangeForm,
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
  readonly storeForm = this.store.selectSignal(selectAuthPasswordChangeForm);

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

  constructor() {
    let initialized = false;
    let previousModel = { newPassword: '', passwordConfirmation: '' };
    effect(() => {
      const storeForm = this.storeForm();
      if (!initialized && storeForm !== undefined) {
        this.passwordChangeModel.set({ ...storeForm });
        previousModel = { ...storeForm };
        initialized = true;
      }
    });
    effect(() => {
      if (!initialized) {
        return;
      }
      const currentModel = this.passwordChangeModel();
      const changes: Partial<typeof currentModel> = {};
      if (currentModel.newPassword !== previousModel.newPassword) {
        changes.newPassword = currentModel.newPassword;
      }
      if (currentModel.passwordConfirmation !== previousModel.passwordConfirmation) {
        changes.passwordConfirmation = currentModel.passwordConfirmation;
      }
      if (Object.keys(changes).length > 0) {
        this.store.dispatch(AuthActions.passwordChangeFormChanged({ changes }));
        previousModel = { ...currentModel };
      }
    });
  }

  onSubmit(): void {
    if (!this.passwordChangeForm().valid()) {
      this.passwordChangeForm().markAsTouched();
      this.passwordChangeForm.newPassword().markAsTouched();
      this.passwordChangeForm.passwordConfirmation().markAsTouched();
      return;
    }

    this.store.dispatch(
      AuthActions.passwordChange({
        password: this.storeForm()?.newPassword ?? this.passwordChangeModel().newPassword,
      }),
    );
  }
}
