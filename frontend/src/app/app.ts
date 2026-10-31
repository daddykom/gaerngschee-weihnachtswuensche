import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, startWith } from 'rxjs';
import { AdminNavigationComponent } from './shared/components/admin-navigation/admin-navigation';
import { InfoBoxComponent } from './shared/components/info-box/info-box';
import { AuthActions } from './store/auth/auth.actions';
import { selectAuthEmail, selectAuthGroup } from './store/auth/auth.feature';
import { SessionActions } from './store/auth/session.actions';
import { selectFrontendPublicConfigStatus } from './store/frontend-config/frontend-config.feature';
import { selectNotification } from './store/notification/notification.feature';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    AdminNavigationComponent,
    TranslatePipe,
    InfoBoxComponent,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  protected title = 'Gaerngschee';
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
    ),
    { initialValue: null },
  );

  readonly notification = this.store.selectSignal(selectNotification);
  private readonly notificationElement = viewChild<ElementRef<HTMLElement>>('notification');
  readonly publicConfigStatus = this.store.selectSignal(selectFrontendPublicConfigStatus);
  readonly authGroup = this.store.selectSignal(selectAuthGroup);
  readonly authEmail = this.store.selectSignal(selectAuthEmail);
  readonly isAdmin = computed(() => this.authGroup() === 'admin');
  readonly isFulfiller = computed(() => this.authGroup() === 'wunscherfueller');
  private lastScrolledNotification: unknown = null;

  constructor() {
    if (this.store.selectSignal(selectAuthGroup)() !== null) {
      this.store.dispatch(SessionActions.pollingStarted());
    }

    afterRenderEffect(() => {
      const notification = this.notification();
      const element = this.notificationElement()?.nativeElement;

      if (!notification || !element || notification === this.lastScrolledNotification) {
        return;
      }

      this.lastScrolledNotification = notification;
      const rectangle = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      if (rectangle.top < 0 || rectangle.bottom > viewportHeight) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  logout(): void {
    this.store.dispatch(AuthActions.logoutRequested());
  }

  readonly pageTitleKey = computed(() => {
    this.navigation();

    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
    }

    return route.snapshot.data['pageTitle'] as string | undefined;
  });
}
