import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { groupGuard } from '../../shared/guards/group.guard';
import { adminOrdersEffects } from '../../store/admin-orders/admin-orders.effects';
import { adminOrdersFeature } from '../../store/admin-orders/admin-orders.feature';
import { adminUsersEffects } from '../../store/admin-users/admin-users.effects';
import { adminUsersFeature } from '../../store/admin-users/admin-users.feature';
import { emailTestEffects } from '../../store/email-test/email-test.effects';
import { emailTestFeature } from '../../store/email-test/email-test.feature';
import { fairgateLookupEffects } from '../../store/fairgate-lookup/fairgate-lookup.effects';
import { fairgateLookupFeature } from '../../store/fairgate-lookup/fairgate-lookup.feature';
import { fairgateTestEffects } from '../../store/fairgate-test/fairgate-test.effects';
import { fairgateTestFeature } from '../../store/fairgate-test/fairgate-test.feature';
import { configurationResolver } from './pages/configuration/configuration.resolver';
import { emailTestResolver } from './pages/email-test/email-test.resolver';
import { adminOrdersResolver } from './pages/order-edit/admin-orders.resolver';
import { adminOverviewResolver } from './pages/overview/admin-overview.resolver';
import { userEditResolver } from './pages/users/user-edit.resolver';
import { usersResolver } from './pages/users/users.resolver';

export const adminRoutes: Routes = [
  {
    path: '',
    providers: [
      provideState(adminUsersFeature),
      provideState(adminOrdersFeature),
      provideState(fairgateTestFeature),
      provideState(fairgateLookupFeature),
      provideState(emailTestFeature),
      provideEffects(
        adminUsersEffects,
        adminOrdersEffects,
        fairgateTestEffects,
        fairgateLookupEffects,
        emailTestEffects,
      ),
    ],
    children: [
      {
        path: 'overview',
        canActivate: [groupGuard(['admin'])],
        resolve: { orders: adminOverviewResolver },
        data: { pageTitle: 'app.admin.overview.title' },
        loadComponent: () =>
          import('./pages/overview/admin-overview.component').then((m) => m.AdminOverviewComponent),
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
              import('./pages/order-item-edit/admin-order-item-edit.component').then(
                (m) => m.AdminOrderItemEditComponent,
              ),
          },
          {
            path: ':orderId/edit',
            canActivate: [groupGuard(['admin'])],
            data: { pageTitle: 'app.admin.overview.editTitle' },
            loadComponent: () =>
              import('./pages/order-edit/admin-order-edit.component').then(
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
          import('./pages/fairgate-test/fairgate-test.component').then(
            (m) => m.FairgateTestComponent,
          ),
      },
      {
        path: 'fairgate-lookup',
        canActivate: [groupGuard(['admin'])],
        data: { pageTitle: 'app.admin.fairgateLookup.title' },
        loadComponent: () =>
          import('./pages/fairgate-lookup/fairgate-lookup').then((m) => m.FairgateLookup),
      },
      {
        path: 'configuration',
        resolve: { configuration: configurationResolver },
        data: { pageTitle: 'app.admin.configuration.title' },
        loadComponent: () =>
          import('./pages/configuration/configuration.component').then(
            (m) => m.ConfigurationComponent,
          ),
      },
      {
        path: 'email-test',
        resolve: { templates: emailTestResolver },
        data: { pageTitle: 'app.admin.emailTest.title' },
        loadComponent: () =>
          import('./pages/email-test/email-test.component').then((m) => m.EmailTestComponent),
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
              import('./pages/users/user-edit.component').then((m) => m.UserEditComponent),
          },
          {
            path: ':userId',
            canActivate: [groupGuard(['admin'])],
            data: { pageTitle: 'app.admin.users.editTitle' },
            resolve: { user: userEditResolver },
            loadComponent: () =>
              import('./pages/users/user-edit.component').then((m) => m.UserEditComponent),
          },
          {
            path: '',
            canActivate: [groupGuard(['admin'])],
            data: { pageTitle: 'app.admin.users.title' },
            loadComponent: () =>
              import('./pages/users/users.component').then((m) => m.UsersComponent),
          },
        ],
      },
    ],
  },
];
