import { Routes } from '@angular/router';
import { clientLoginGuard } from './features/auth/guards/client-login.guard';
import { publicConfigurationResolver } from './features/public-configuration/public-configuration.resolver';
import { groupGuard } from './shared/guards/group.guard';

export const appRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { pageTitle: 'app.home.title' },
        loadComponent: () =>
          import('./features/home/pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'start',
        loadChildren: () => import('./features/auth/start.routes').then((m) => m.startRoutes),
      },
      {
        path: 'login',
        data: { pageTitle: 'app.login.pageTitle' },
        loadComponent: () =>
          import('./features/auth/pages/login/login.component').then((m) => m.Login),
      },
      {
        path: 'user/gift-receipts',
        canActivate: [groupGuard(['user', 'admin'])],
        loadChildren: () =>
          import('./features/gift-receipts/gift-receipts.routes').then((m) => m.giftReceiptRoutes),
      },
      {
        path: 'user/profile',
        canActivate: [groupGuard(['user', 'admin'])],
        loadChildren: () =>
          import('./features/admin/user-profile.routes').then((m) => m.userProfileRoutes),
      },
      {
        path: 'client-login',
        canMatch: [clientLoginGuard],
        data: { pageTitle: 'app.anmeldung.title' },
        loadComponent: () =>
          import('./features/auth/pages/client-login/client-login').then(
            (m) => m.ClientLoginComponent,
          ),
      },
      {
        path: 'bestellung',
        canActivate: [groupGuard(['wunschbesteller'])],
        loadChildren: () => import('./features/order/order.routes').then((m) => m.orderRoutes),
      },
      {
        path: 'bestellung/bestaetigung',
        data: { pageTitle: 'app.order.confirmation.pageTitle' },
        loadComponent: () =>
          import('./features/order/pages/order-confirmation/order-confirmation.component').then(
            (m) => m.OrderConfirmationComponent,
          ),
      },
      {
        path: 'erfuellen',
        loadChildren: () =>
          import('./features/fulfiller/fulfillment.routes').then((m) => m.fulfillmentRoutes),
      },
      {
        path: 'fulfiller-reservation',
        loadComponent: () =>
          import(
            './features/fulfiller/pages/reservation-confirmation/reservation-confirmation.component'
          ).then((m) => m.ReservationConfirmationComponent),
      },
      {
        path: 'password-change',
        data: { pageTitle: 'app.passwordChange.pageTitle' },
        loadComponent: () =>
          import('./features/auth/pages/password-change/password-change.component').then(
            (m) => m.PasswordChange,
          ),
      },
      {
        path: 'password-reset-request',
        loadChildren: () =>
          import('./features/auth/password-reset.routes').then((m) => m.passwordResetRequestRoutes),
      },
      {
        path: 'password-reset',
        loadChildren: () =>
          import('./features/auth/password-reset.routes').then((m) => m.passwordResetRoutes),
      },
      {
        path: 'impressum',
        data: { legalPage: 'impressum', pageTitle: 'app.legal.imprintPageTitle' },
        loadComponent: () =>
          import('./features/legal/pages/legal-page/legal-page.component').then(
            (m) => m.LegalPageComponent,
          ),
      },
      {
        path: 'datenschutz',
        data: { legalPage: 'datenschutz', pageTitle: 'app.legal.privacyPageTitle' },
        loadComponent: () =>
          import('./features/legal/pages/legal-page/legal-page.component').then(
            (m) => m.LegalPageComponent,
          ),
      },
      {
        path: 'not-found',
        data: { pageTitle: 'app.notFound.pageTitle' },
        loadComponent: () =>
          import('./features/errors/pages/not-found/not-found.component').then(
            (m) => m.NotFoundComponent,
          ),
      },
      {
        path: 'admin',
        canActivate: [groupGuard(['admin'])],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
      },
      { path: '**', redirectTo: 'not-found' },
    ],
    resolve: { publicConfiguration: publicConfigurationResolver },
  },
];
