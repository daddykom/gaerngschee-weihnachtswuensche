import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { fulfillerOrdersEffects } from '../../store/fulfiller-orders/fulfiller-orders.effects';
import { fulfillerOrdersFeature } from '../../store/fulfiller-orders/fulfiller-orders.feature';
import { fulfillmentResolver } from './pages/fulfillment/fulfillment.resolver';

export const fulfillmentRoutes: Routes = [
  {
    path: '',
    providers: [provideState(fulfillerOrdersFeature), provideEffects(fulfillerOrdersEffects)],
    resolve: { orders: fulfillmentResolver },
    data: { pageTitle: 'app.fulfiller.pageTitle' },
    loadComponent: () =>
      import('./pages/fulfillment/fulfillment-page.component').then(
        (m) => m.FulfillmentPageComponent,
      ),
  },
];
