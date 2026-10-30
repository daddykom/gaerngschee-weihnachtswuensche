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
import { AdminUserForm } from '../../../../store/admin-users/admin-users.state';
import {
  selectAdminUsersDetailLoading,
  selectAdminUsersSaving,
  selectAdminUsersSelectedUser,
  selectAdminUsersForm,
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
  readonly storeForm = this.store.selectSignal(selectAdminUsersForm);
  readonly userId = this.route.snapshot.paramMap.get('userId');
  readonly isProfile = this.route.snapshot.routeConfig?.path === 'user/profile';
  readonly isNew = this.route.snapshot.routeConfig?.path === 'new';
  readonly model = signal<AdminUserForm>({
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
    if (this.isNew) {
      this.store.dispatch(
        AdminUsersActions.formLoaded({
          form: { email: '', group: 'user', requiredPasswordReset: false },
        }),
      );
    }
    let initialized = false;
    let previousModel = this.model();
    effect(() => {
      const user = this.selectedUser();
      if (user === null || this.isNew) {
        return;
      }
      const form = {
        email: user.email,
        group: user.group === 'admin' ? 'admin' : 'user',
        requiredPasswordReset: user.required_password_reset,
      } as const;
      this.store.dispatch(AdminUsersActions.formLoaded({ form }));
      this.model.set(form);
      previousModel = form;
      initialized = true;
    });
    effect(() => {
      const storeForm = this.storeForm();
      if (!initialized && (this.isNew || storeForm !== undefined)) {
        this.model.set({ ...storeForm });
        previousModel = { ...storeForm };
        initialized = true;
      }
    });
    effect(() => {
      if (!initialized) {
        return;
      }
      const currentModel = this.model();
      const changes: Partial<typeof currentModel> = {};
      if (currentModel.email !== previousModel.email) changes.email = currentModel.email;
      if (currentModel.group !== previousModel.group) changes.group = currentModel.group;
      if (currentModel.requiredPasswordReset !== previousModel.requiredPasswordReset) {
        changes.requiredPasswordReset = currentModel.requiredPasswordReset;
      }
      if (Object.keys(changes).length > 0) {
        this.store.dispatch(AdminUsersActions.formChanged({ changes }));
        previousModel = { ...currentModel };
      }
    });
  }

  onSubmit(): void {
    if (!this.form().valid()) {
      this.form.email().markAsTouched();
      this.form.group().markAsTouched();
      return;
    }

    const value = this.storeForm() ?? this.model();
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
