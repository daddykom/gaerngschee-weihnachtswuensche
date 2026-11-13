import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { adminUsersEffects } from '../../store/admin-users/admin-users.effects';
import { adminUsersFeature } from '../../store/admin-users/admin-users.feature';
import { userEditResolver } from './pages/users/user-edit.resolver';

export const userProfileRoutes: Routes = [
  {
    path: '',
    providers: [provideState(adminUsersFeature), provideEffects(adminUsersEffects)],
    resolve: { user: userEditResolver },
    data: { pageTitle: 'app.user.profile.title' },
    loadComponent: () =>
      import('./pages/users/user-edit.component').then((m) => m.UserEditComponent),
  },
];
