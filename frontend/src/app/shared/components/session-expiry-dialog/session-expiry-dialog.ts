import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthActions } from '../../../store/auth/auth.actions';
import {
  selectAuthSessionRefreshLoading,
  selectAuthSessionSecondsRemaining,
} from '../../../store/auth/auth.feature';
import { SessionActions } from '../../../store/auth/session.actions';

@Component({
  selector: 'app-session-expiry-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  templateUrl: './session-expiry-dialog.html',
  styleUrl: './session-expiry-dialog.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SessionExpiryDialogComponent {
  private readonly store = inject(Store);
  private readonly dialogRef = inject(MatDialogRef<SessionExpiryDialogComponent>);

  readonly secondsRemaining = this.store.selectSignal(selectAuthSessionSecondsRemaining);
  readonly refreshing = this.store.selectSignal(selectAuthSessionRefreshLoading);
  staySignedIn(): void {
    this.store.dispatch(SessionActions.refreshRequested());
  }

  logout(): void {
    this.dialogRef.close();
    this.store.dispatch(AuthActions.logoutRequested());
  }
}
