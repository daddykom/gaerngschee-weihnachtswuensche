import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { AdminUsersActions } from '../../../../store/admin-users/admin-users.actions';
import {
  selectAdminUsers,
  selectAdminUsersLoading,
} from '../../../../store/admin-users/admin-users.feature';

@Component({
  selector: 'app-admin-users',
  imports: [MatButtonModule, RouterLink, TranslatePipe],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  readonly users = this.store.selectSignal(selectAdminUsers);
  readonly loading = this.store.selectSignal(selectAdminUsersLoading);

  deleteUser(userId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'app.admin.users.deleteTitle',
        message: 'app.admin.users.deleteMessage',
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
