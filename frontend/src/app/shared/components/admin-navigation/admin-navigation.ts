import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthActions } from '../../../store/auth/auth.actions';

@Component({
  selector: 'app-admin-navigation',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
  ],
  templateUrl: './admin-navigation.html',
  styleUrl: './admin-navigation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNavigationComponent {
  private readonly store = inject(Store);
  readonly email = input<string | null>(null);

  logout(): void {
    this.store.dispatch(AuthActions.logoutRequested());
  }
}
