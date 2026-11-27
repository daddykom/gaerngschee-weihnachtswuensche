import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../../shared/components/control-error/control-error';
import { imageChangeError } from '../../../../../shared/models/order-item-image-validation';
import { OrderItemImageChange } from '../../../../../shared/models/order-item-image.model';

@Component({
  imports: [MatButtonModule, TranslatePipe, ControlErrorComponent],
  selector: 'app-order-item-image-editor',
  styleUrl: './order-item-image-editor.component.scss',
  templateUrl: './order-item-image-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderItemImageEditorComponent {
  readonly change = input<OrderItemImageChange | null>();
  readonly storedImage = input<Blob | null>(null);
  readonly control = input.required<FieldState<unknown>>();
  readonly disabled = input(false);
  readonly fileSelected = output<File>();
  readonly removeClicked = output<void>();
  readonly resetClicked = output<void>();
  readonly previewUrl = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const change = this.change();
      const blob =
        change?.operation === 'remove' || imageChangeError(change)
          ? null
          : change?.operation === 'replace'
            ? change.file
            : this.storedImage();
      const url = blob ? URL.createObjectURL(blob) : null;
      this.previewUrl.set(url);
      onCleanup(() => {
        if (url) URL.revokeObjectURL(url);
      });
    });
  }

  select(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && !this.disabled()) this.fileSelected.emit(file);
    input.value = '';
  }

  dragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = this.disabled() ? 'none' : 'copy';
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) {
      const file = event.dataTransfer?.files[0];
      if (file) this.fileSelected.emit(file);
    }
  }
}
