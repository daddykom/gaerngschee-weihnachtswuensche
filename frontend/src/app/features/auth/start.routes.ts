import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { startEffects } from '../../store/start/start.effects';
import { startFeature } from '../../store/start/start.feature';

export const startRoutes: Routes = [
  {
    path: '',
    providers: [provideState(startFeature), provideEffects(startEffects)],
    children: [
      {
        path: '',
        data: { pageTitle: 'app.anmeldung.title' },
        loadComponent: () =>
          import('./pages/start/weihnachtswuensche-start.component').then(
            (m) => m.WeihnachtswuenscheStartComponent,
          ),
      },
      {
        path: 'success',
        data: { pageTitle: 'app.anmeldung.emailSentTitle' },
        loadComponent: () =>
          import('./pages/start-success/start-success').then((m) => m.StartSuccess),
      },
    ],
  },
];
