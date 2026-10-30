import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { configurationResolver } from './features/admin/pages/configuration/configuration.resolver';
import { adminOrdersResolver } from './features/admin/pages/order-edit/admin-orders.resolver';
import { adminOverviewResolver } from './features/admin/pages/overview/admin-overview.resolver';
import { userEditResolver } from './features/admin/pages/users/user-edit.resolver';
import { usersResolver } from './features/admin/pages/users/users.resolver';
import { clientLoginGuard } from './features/auth/guards/client-login.guard';
import { orderResolver } from './features/order/pages/order/order.resolver';
import { publicConfigurationResolver } from './features/public-configuration/public-configuration.resolver';
import { groupGuard } from './shared/guards/group.guard';
import { adminOrdersEffects } from './store/admin-orders/admin-orders.effects';
import { adminOrdersFeature } from './store/admin-orders/admin-orders.feature';
import { adminUsersEffects } from './store/admin-users/admin-users.effects';
import { adminUsersFeature } from './store/admin-users/admin-users.feature';
import { fairgateLookupEffects } from './store/fairgate-lookup/fairgate-lookup.effects';
import { fairgateLookupFeature } from './store/fairgate-lookup/fairgate-lookup.feature';
import { fairgateTestEffects } from './store/fairgate-test/fairgate-test.effects';
import { fairgateTestFeature } from './store/fairgate-test/fairgate-test.feature';
import { orderEffects } from './store/order/order.effects';
import { orderFeature } from './store/order/order.feature';
import { passwordResetFeature } from './store/password-reset/password-reset.feature';
import { startEffects } from './store/start/start.effects';
import { startFeature } from './store/start/start.feature';

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
        providers: [provideState(startFeature), provideEffects(startEffects)],
        children: [
          {
            path: '',
            data: { pageTitle: 'app.anmeldung.title' },
            loadComponent: () =>
              import('./features/auth/pages/start/weihnachtswuensche-start.component').then(
                (m) => m.WeihnachtswuenscheStartComponent,
              ),
          },
          {
            path: 'success',
            data: { pageTitle: 'app.anmeldung.emailSentTitle' },
            loadComponent: () =>
              import('./features/auth/pages/start-success/start-success').then(
                (m) => m.StartSuccess,
              ),
          },
        ],
      },
      {
        path: 'login',
        data: { pageTitle: 'app.login.pageTitle' },
        loadComponent: () =>
          import('./features/auth/pages/login/login.component').then((m) => m.Login),
      },
      {
        path: 'user/profile',
        canActivate: [groupGuard(['user', 'admin'])],
        providers: [provideState(adminUsersFeature), provideEffects(adminUsersEffects)],
        resolve: { user: userEditResolver },
        data: { pageTitle: 'app.user.profile.title' },
        loadComponent: () =>
          import('./features/admin/pages/users/user-edit.component').then(
            (m) => m.UserEditComponent,
          ),
      },
      {
        path: 'client-login',
        canMatch: [clientLoginGuard],
        children: [{ path: '', redirectTo: 'start', pathMatch: 'full' }],
      },
      {
        path: 'bestellung',
        canActivate: [groupGuard(['wunschbesteller'])],
        providers: [provideState(orderFeature), provideEffects(orderEffects)],
        resolve: { order: orderResolver },
        children: [
          {
            path: '',
            data: { pageTitle: 'app.order.pageTitle' },
            loadComponent: () =>
              import('./features/order/pages/order/order.component').then((m) => m.OrderComponent),
          },
          {
            path: 'wunsch/neu',
            data: { pageTitle: 'app.order.itemEditor.newTitle' },
            loadComponent: () =>
              import('./features/order/pages/item-editor/item-editor.component').then(
                (m) => m.ItemEditorComponent,
              ),
          },
          {
            path: 'wunsch/:itemId',
            data: { pageTitle: 'app.order.itemEditor.editTitle' },
            loadComponent: () =>
              import('./features/order/pages/item-editor/item-editor.component').then(
                (m) => m.ItemEditorComponent,
              ),
          },
        ],
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
        path: 'password-change',
        data: { pageTitle: 'app.passwordChange.pageTitle' },
        loadComponent: () =>
          import('./features/auth/pages/password-change/password-change.component').then(
            (m) => m.PasswordChange,
          ),
      },
      {
        path: 'password-reset-request',
        providers: [provideState(passwordResetFeature)],
        data: { pageTitle: 'app.passwordResetRequest.pageTitle' },
        loadComponent: () =>
          import(
            './features/auth/pages/password-reset-request/password-reset-request.component'
          ).then((m) => m.PasswordResetRequestComponent),
      },
      {
        path: 'password-reset',
        providers: [provideState(passwordResetFeature)],
        data: { pageTitle: 'app.passwordReset.pageTitle' },
        loadComponent: () =>
          import('./features/auth/pages/password-reset/password-reset.component').then(
            (m) => m.PasswordResetComponent,
          ),
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
        providers: [
          provideState(adminUsersFeature),
          provideState(adminOrdersFeature),
          provideState(fairgateTestFeature),
          provideState(fairgateLookupFeature),
          provideEffects(
            adminUsersEffects,
            adminOrdersEffects,
            fairgateTestEffects,
            fairgateLookupEffects,
          ),
        ],
        children: [
          {
            path: 'overview',
            canActivate: [groupGuard(['admin'])],
            resolve: { orders: adminOverviewResolver },
            data: { pageTitle: 'app.admin.overview.title' },
            loadComponent: () =>
              import('./features/admin/pages/overview/admin-overview.component').then(
                (m) => m.AdminOverviewComponent,
              ),
          },
          {
            path: 'orders',
            resolve: { orders: adminOrdersResolver },
            children: [
              {
                path: ':orderId/edit/item/:itemId',
                canActivate: [groupGuard(['admin'])],
                data: { pageTitle: 'app.admin.overview.itemEditTitle' },
                loadComponent: () =>
                  import(
                    './features/admin/pages/order-item-edit/admin-order-item-edit.component'
                  ).then((m) => m.AdminOrderItemEditComponent),
              },
              {
                path: ':orderId/edit',
                canActivate: [groupGuard(['admin'])],
                data: { pageTitle: 'app.admin.overview.editTitle' },
                loadComponent: () =>
                  import('./features/admin/pages/order-edit/admin-order-edit.component').then(
                    (m) => m.AdminOrderEditComponent,
                  ),
              },
            ],
          },
          {
            path: 'fairgate-test',
            canActivate: [groupGuard(['admin'])],
            data: { pageTitle: 'app.admin.fairgateTest.title' },
            loadComponent: () =>
              import('./features/admin/pages/fairgate-test/fairgate-test.component').then(
                (m) => m.FairgateTestComponent,
              ),
          },
          {
            path: 'fairgate-lookup',
            canActivate: [groupGuard(['admin'])],
            data: { pageTitle: 'app.admin.fairgateLookup.title' },
            loadComponent: () =>
              import('./features/admin/pages/fairgate-lookup/fairgate-lookup').then(
                (m) => m.FairgateLookup,
              ),
          },
          {
            path: 'configuration',
            resolve: { configuration: configurationResolver },
            data: { pageTitle: 'app.admin.configuration.title' },
            loadComponent: () =>
              import('./features/admin/pages/configuration/configuration.component').then(
                (m) => m.ConfigurationComponent,
              ),
          },
          {
            path: 'users',
            resolve: { users: usersResolver },
            children: [
              {
                path: 'new',
                canActivate: [groupGuard(['admin'])],
                data: { pageTitle: 'app.admin.users.createTitle' },
                loadComponent: () =>
                  import('./features/admin/pages/users/user-edit.component').then(
                    (m) => m.UserEditComponent,
                  ),
              },
              {
                path: ':userId',
                canActivate: [groupGuard(['admin'])],
                data: { pageTitle: 'app.admin.users.editTitle' },
                resolve: { user: userEditResolver },
                loadComponent: () =>
                  import('./features/admin/pages/users/user-edit.component').then(
                    (m) => m.UserEditComponent,
                  ),
              },
              {
                path: '',
                canActivate: [groupGuard(['admin'])],
                data: { pageTitle: 'app.admin.users.title' },
                loadComponent: () =>
                  import('./features/admin/pages/users/users.component').then(
                    (m) => m.UsersComponent,
                  ),
              },
            ],
          },
        ],
      },
      { path: '**', redirectTo: 'not-found' },
    ],
    resolve: { publicConfiguration: publicConfigurationResolver },
  },
];
