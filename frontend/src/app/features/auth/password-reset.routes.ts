import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { passwordResetFeature } from '../../store/password-reset/password-reset.feature';

export const passwordResetRequestRoutes: Routes = [
  {
    path: '',
    providers: [provideState(passwordResetFeature)],
    data: { pageTitle: 'app.passwordResetRequest.pageTitle' },
    loadComponent: () =>
      import('./pages/password-reset-request/password-reset-request.component').then(
        (m) => m.PasswordResetRequestComponent,
      ),
  },
];

export const passwordResetRoutes: Routes = [
  {
    path: '',
    providers: [provideState(passwordResetFeature)],
    data: { pageTitle: 'app.passwordReset.pageTitle' },
    loadComponent: () =>
      import('./pages/password-reset/password-reset.component').then(
        (m) => m.PasswordResetComponent,
      ),
  },
];
