import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { AuthActions } from '../../../../store/auth/auth.actions';
import {
  selectAuthEmailCheckEmail,
  selectAuthEmailCheckLoading,
  selectAuthEmailCheckMode,
  selectAuthLoading,
} from '../../../../store/auth/auth.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';

@Component({
  selector: 'app-login',
  imports: [MatInputModule, MatButtonModule, FormField, TranslatePipe, ControlErrorComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.component.scss',
})
export class Login implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);

  readonly loading = this.store.selectSignal(selectAuthLoading);
  readonly emailCheckLoading = this.store.selectSignal(selectAuthEmailCheckLoading);
  readonly emailCheckMode = this.store.selectSignal(selectAuthEmailCheckMode);
  readonly emailCheckEmail = this.store.selectSignal(selectAuthEmailCheckEmail);

  readonly loginModel = signal({ email: '', password: '' });
  readonly loginForm = form(this.loginModel, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
    required(schema.password);
    maxLength(schema.password, inputLimits.password);
  });

  readonly passwordRequired = computed(
    () =>
      this.emailCheckMode() === 'password' &&
      this.loginModel().email.trim().toLowerCase() === this.emailCheckEmail(),
  );

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.loginModel.update((model) => ({ ...model, email }));
    }
  }

  onSubmit(): void {
    if (!this.loginForm.email().valid()) {
      this.loginForm.email().markAsTouched();
      return;
    }

    const { email, password } = this.loginModel();

    if (!this.passwordRequired()) {
      this.store.dispatch(AuthActions.checkEmail({ email }));
      return;
    }

    if (!this.loginForm.password().valid()) {
      this.loginForm.password().markAsTouched();
      return;
    }

    this.store.dispatch(AuthActions.login({ email, password }));
  }

  onForgotPassword(): void {
    this.store.dispatch(NavigationActions.navigate({ target: '/password-reset-request' }));
  }
}
