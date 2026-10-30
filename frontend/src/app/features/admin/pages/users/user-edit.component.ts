import { Component, computed, effect, inject, signal } from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { AdminUsersActions } from '../../../../store/admin-users/admin-users.actions';
import {
  selectAdminUsersDetailLoading,
  selectAdminUsersSaving,
  selectAdminUsersSelectedUser,
} from '../../../../store/admin-users/admin-users.feature';
import { selectAuthGroup } from '../../../../store/auth/auth.feature';
import { NavigationActions } from '../../../../store/navigation/navigation.actions';

@Component({
  selector: 'app-admin-user-edit',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatSelectModule,
    FormField,
    TranslatePipe,
    ControlErrorComponent,
  ],
  templateUrl: './user-edit.component.html',
  styleUrl: './user-edit.component.scss',
})
export class UserEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);

  private readonly authGroup = this.store.selectSignal(selectAuthGroup);
  readonly isAdmin = computed(() => this.authGroup() === 'admin');
  readonly saving = this.store.selectSignal(selectAdminUsersSaving);
  readonly loading = this.store.selectSignal(selectAdminUsersDetailLoading);
  readonly selectedUser = this.store.selectSignal(selectAdminUsersSelectedUser);
  readonly userId = this.route.snapshot.paramMap.get('userId');
  readonly isProfile = this.route.snapshot.routeConfig?.path === 'user/profile';
  readonly isNew = this.route.snapshot.routeConfig?.path === 'new';
  readonly model = signal<{
    email: string;
    group: 'admin' | 'user';
    requiredPasswordReset: boolean;
  }>({
    email: '',
    group: 'user',
    requiredPasswordReset: false,
  });
  readonly form = form(this.model, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
    required(schema.group);
  });
  constructor() {
    effect(() => {
      const user = this.selectedUser();
      if (user === null || this.isNew) {
        return;
      }
      this.model.set({
        email: user.email,
        group: user.group === 'admin' ? 'admin' : 'user',
        requiredPasswordReset: user.required_password_reset,
      });
    });
  }

  onSubmit(): void {
    if (!this.form().valid()) {
      this.form.email().markAsTouched();
      this.form.group().markAsTouched();
      return;
    }

    const value = this.model();
    if (this.isNew) {
      this.store.dispatch(AdminUsersActions.create({ email: value.email, group: value.group }));
      return;
    }

    if (this.userId === null && !this.isProfile) {
      return;
    }

    const changes =
      this.isAdmin() && !this.isProfile
        ? {
            email: value.email,
            group: value.group,
            required_password_reset: value.requiredPasswordReset,
          }
        : { email: value.email };

    if (this.isProfile) {
      this.store.dispatch(AdminUsersActions.updateProfile({ changes: { email: value.email } }));
      return;
    }

    this.store.dispatch(AdminUsersActions.update({ userId: this.userId as string, changes }));
  }

  cancel(): void {
    this.store.dispatch(NavigationActions.navigate({ target: 'back' }));
  }
}
