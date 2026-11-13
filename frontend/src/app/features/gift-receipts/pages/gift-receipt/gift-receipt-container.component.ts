import { ChangeDetectionStrategy, Component, effect, inject, linkedSignal } from '@angular/core';
import { form, required, validate } from '@angular/forms/signals';
import { Store } from '@ngrx/store';
import { GiftReceiptsActions } from '../../../../store/gift-receipts/gift-receipts.actions';
import { giftReceiptsFeature } from '../../../../store/gift-receipts/gift-receipts.feature';
import { GiftReceiptViewComponent } from '../../components/gift-receipt-view/gift-receipt-view.component';

@Component({
  selector: 'app-gift-receipt-container',
  imports: [GiftReceiptViewComponent],
  templateUrl: './gift-receipt-container.component.html',
  styleUrl: './gift-receipt-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GiftReceiptContainerComponent {
  private readonly store = inject(Store);
  readonly storeForm = this.store.selectSignal(giftReceiptsFeature.selectForm);
  readonly lookup = this.store.selectSignal(giftReceiptsFeature.selectLookup);
  readonly receipt = this.store.selectSignal(giftReceiptsFeature.selectReceipt);
  readonly formModel = linkedSignal(() => this.storeForm());
  readonly searchForm = form(this.formModel, (schema) => {
    required(schema.giftNumber);
    validate(schema.giftNumber, ({ value }) => {
      const number = value().trim();
      if (value() === '') return undefined;
      if (number === '') return { kind: 'required' };
      const parts = /^([1-9][0-9]{0,9})-([1-9][0-9]{0,9})$/.exec(number);
      return parts && Number(parts[1]) <= 2147483647 && Number(parts[2]) <= 2147483647
        ? undefined
        : { kind: 'format' };
    });
  });

  constructor() {
    effect(() => {
      const giftNumber = this.formModel().giftNumber;
      if (giftNumber !== this.storeForm().giftNumber) {
        this.store.dispatch(GiftReceiptsActions.formChanged({ changes: { giftNumber } }));
      }
    });
  }

  search(): void {
    if (this.searchForm().valid()) {
      this.store.dispatch(
        GiftReceiptsActions.searchSubmitted({ giftNumber: this.formModel().giftNumber.trim() }),
      );
    }
  }

  receive(): void {
    this.store.dispatch(GiftReceiptsActions.receiptRequested());
  }
}
