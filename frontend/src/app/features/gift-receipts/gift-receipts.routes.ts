import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { giftReceiptsEffects } from '../../store/gift-receipts/gift-receipts.effects';
import { giftReceiptsFeature } from '../../store/gift-receipts/gift-receipts.feature';

export const giftReceiptRoutes: Routes = [
  {
    path: '',
    providers: [provideState(giftReceiptsFeature), provideEffects(giftReceiptsEffects)],
    data: { pageTitle: 'app.giftReceipts.title' },
    loadComponent: () =>
      import('./pages/gift-receipt/gift-receipt-container.component').then(
        (m) => m.GiftReceiptContainerComponent,
      ),
  },
];
