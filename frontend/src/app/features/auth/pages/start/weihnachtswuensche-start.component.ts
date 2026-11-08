import { Component, effect, inject, signal, untracked } from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { InfoBoxComponent } from '../../../../shared/components/info-box/info-box';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { StartActions } from '../../../../store/start/start.actions';
import { selectStartForm } from '../../../../store/start/start.feature';

@Component({
  selector: 'app-weihnachtswuensche-start',
  standalone: true,
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
    InfoBoxComponent,
    ControlErrorComponent,
  ],
  templateUrl: './weihnachtswuensche-start.component.html',
  styleUrl: './weihnachtswuensche-start.component.scss',
})
export class WeihnachtswuenscheStartComponent {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);
  private readonly storeForm = this.store.selectSignal(selectStartForm);

  readonly model = signal({
    email: '',
  });
  readonly form = form(this.model, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
  });

  constructor() {
    let initialized = false;
    let previousEmail = '';
    effect(() => {
      const storeForm = this.storeForm();
      if (!initialized && storeForm !== undefined) {
        this.model.set({ email: storeForm.email });
        previousEmail = storeForm.email;
        initialized = true;
      }
    });
    effect(() => {
      if (!initialized) {
        return;
      }
      const emailValue = this.model().email;
      if (emailValue !== previousEmail) {
        this.store.dispatch(StartActions.formChanged({ changes: { email: emailValue } }));
        previousEmail = emailValue;
      }
    });
  }

  submit(): void {
    if (!this.form().valid()) {
      this.form.email().markAsTouched();
      return;
    }

    const email = this.storeForm()?.email ?? untracked(this.model).email;
    this.store.dispatch(
      StartActions.submit({ email, language: this.translate.getCurrentLang() ?? 'de' }),
    );
  }
}
