import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { receiptConfirmation } from '../../../../shared/utils/gift-receipt';
import {
  GiftReceiptForm,
  GiftReceiptLookup,
} from '../../../../store/gift-receipts/gift-receipts.state';

@Component({
  selector: 'app-gift-receipt-view',
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
    ControlErrorComponent,
  ],
  templateUrl: './gift-receipt-view.component.html',
  styleUrl: './gift-receipt-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GiftReceiptViewComponent {
  readonly searchForm = input.required<FieldTree<GiftReceiptForm>>();
  readonly lookup = input.required<GiftReceiptLookup>();
  readonly searchSubmitted = output<void>();
  readonly receiptStatus = input<string>('initial');
  readonly receiptRequested = output<void>();
  readonly busy = computed(() => ['confirming', 'saving'].includes(this.receiptStatus()));
  readonly canReceive = computed(() => {
    const lookup = this.lookup();
    return lookup.status === 'loaded' && receiptConfirmation(lookup.result) !== null;
  });
  private readonly numberInput = viewChild<ElementRef<HTMLInputElement>>('numberInput');

  submit(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    const field = this.searchForm().giftNumber;
    field().markAsTouched();
    if (!field().valid()) {
      field().focusBoundControl();
      this.numberInput()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.searchSubmitted.emit();
  }
}
