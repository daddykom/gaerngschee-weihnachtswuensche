import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { AuthActions } from '../../../../store/auth/auth.actions';
import { selectPasswordResetLoading } from '../../../../store/password-reset/password-reset.feature';

@Component({
  selector: 'app-password-reset',
  imports: [MatInputModule, MatButtonModule, FormField, TranslatePipe, ControlErrorComponent],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PasswordResetComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';
  readonly loading = this.store.selectSignal(selectPasswordResetLoading);
  readonly model = signal({ email: this.email, newPassword: '', passwordConfirmation: '' });
  readonly passwordResetForm = form(this.model, (schema) => {
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
    if (this.token) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
  }

  onSubmit(): void {
    if (!this.token || !this.passwordResetForm().valid()) {
      this.passwordResetForm().markAsTouched();
      this.passwordResetForm.newPassword().markAsTouched();
      this.passwordResetForm.passwordConfirmation().markAsTouched();
      return;
    }

    this.store.dispatch(
      AuthActions.passwordReset({ token: this.token, password: this.model().newPassword }),
    );
  }
}
