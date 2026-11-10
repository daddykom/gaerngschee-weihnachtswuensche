import { Component, effect, inject, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { UserGroup } from '../../../../shared/models/frontend-config.model';
import { AdminUsersActions } from '../../../../store/admin-users/admin-users.actions';
import {
  selectAdminUsersFilteredUsers,
  selectAdminUsersFilters,
  selectAdminUsersLoading,
} from '../../../../store/admin-users/admin-users.feature';
import { AdminUserFilters } from '../../../../store/admin-users/admin-users.state';

@Component({
  selector: 'app-admin-users',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormField,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  readonly users = this.store.selectSignal(selectAdminUsersFilteredUsers);
  readonly loading = this.store.selectSignal(selectAdminUsersLoading);
  readonly filters = this.store.selectSignal(selectAdminUsersFilters);
  readonly filterModel = linkedSignal(() => this.filters());
  readonly filterForm = form(this.filterModel);
  readonly groups: UserGroup[] = ['admin', 'user', 'wunschbesteller', 'wunscherfueller'];

  constructor() {
    effect(() => {
      const current = this.filterModel();
      const stored = this.filters();
      const changes: Partial<AdminUserFilters> = {
        ...(current.email !== stored.email ? { email: current.email } : {}),
        ...(current.group !== stored.group ? { group: current.group } : {}),
      };
      if (Object.keys(changes).length > 0) {
        this.store.dispatch(AdminUsersActions.filtersChanged({ changes }));
      }
    });
  }

  deleteUser(userId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'app.admin.users.deleteTitle',
        message:
          this.users().find((user) => user.id === userId)?.group === 'wunschbesteller'
            ? 'app.admin.users.deleteClientMessage'
            : 'app.admin.users.deleteMessage',
        confirmLabel: 'app.admin.users.deleteConfirm',
        cancelLabel: 'app.admin.users.cancel',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.store.dispatch(AdminUsersActions.delete({ userId }));
      }
    });
  }

  sendPasswordReset(userId: string): void {
    this.store.dispatch(AdminUsersActions.sendPasswordReset({ userId }));
  }
}
