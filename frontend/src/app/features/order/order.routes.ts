import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { orderEffects } from '../../store/order/order.effects';
import { orderFeature } from '../../store/order/order.feature';
import { orderResolver } from './pages/order/order.resolver';

export const orderRoutes: Routes = [
  {
    path: '',
    providers: [provideState(orderFeature), provideEffects(orderEffects)],
    resolve: { order: orderResolver },
    children: [
      {
        path: '',
        data: { pageTitle: 'app.order.pageTitle' },
        loadComponent: () => import('./pages/order/order.component').then((m) => m.OrderComponent),
      },
      {
        path: 'wunsch/neu',
        data: { pageTitle: 'app.order.itemEditor.newTitle' },
        loadComponent: () =>
          import('./pages/item-editor/item-editor.component').then((m) => m.ItemEditorComponent),
      },
      {
        path: 'wunsch/:itemId',
        data: { pageTitle: 'app.order.itemEditor.editTitle' },
        loadComponent: () =>
          import('./pages/item-editor/item-editor.component').then((m) => m.ItemEditorComponent),
      },
    ],
  },
];
