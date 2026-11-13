import {
  ChangeDetectionStrategy,
  Component,
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
  private readonly numberInput = viewChild<ElementRef<HTMLInputElement>>('numberInput');

  submit(event: Event): void {
    event.preventDefault();
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
