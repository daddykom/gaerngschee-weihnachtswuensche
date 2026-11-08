import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FieldState } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-control-error',
  imports: [TranslatePipe],
  templateUrl: './control-error.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './control-error.scss',
})
export class ControlErrorComponent {
  control = input.required<AbstractControl | FieldState<unknown>>();
  translationPrefix = input.required<string>();

  private readonly statusVersion = signal(0);

  readonly firstErrorKey = computed(() => {
    this.statusVersion();
    const control = this.control();

    if (this.isSignalField(control)) {
      if (!control.touched()) {
        return null;
      }

      const errors = control.errors();
      return errors[0]?.kind ?? (control.required() && !control.value() ? 'required' : null);
    }

    if (!control.touched || !control.errors) {
      return null;
    }

    return Object.keys(control.errors)[0] ?? null;
  });

  readonly errorTranslationKey = computed(() => {
    const errorKey = this.firstErrorKey();
    return errorKey ? `${this.translationPrefix()}.${errorKey}` : null;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      if (this.isSignalField(control)) {
        control.touched();
        control.errors();
        control.value();
        this.statusVersion.update((version) => version + 1);
        return;
      }

      const subscription = control.events.subscribe(() => {
        this.statusVersion.update((version) => version + 1);
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  private isSignalField(
    control: AbstractControl | FieldState<unknown>,
  ): control is FieldState<unknown> {
    return typeof control.touched === 'function';
  }
}
