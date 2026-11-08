import { Component, effect, inject, signal, untracked } from '@angular/core';
import { email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
    MatCheckboxModule,
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
    privacyAccepted: false,
  });
  readonly form = form(this.model, (schema) => {
    required(schema.email);
    email(schema.email);
    maxLength(schema.email, inputLimits.email);
    required(schema.privacyAccepted);
  });

  constructor() {
    let initialized = false;
    let previous = this.model();
    effect(() => {
      const storeForm = this.storeForm();
      if (!initialized && storeForm !== undefined) {
        this.model.set({
          email: storeForm.email,
          privacyAccepted: storeForm.privacyAccepted,
        });
        previous = this.model();
        initialized = true;
      }
    });
    effect(() => {
      if (!initialized) {
        return;
      }
      const current = this.model();
      if (
        current.email !== previous.email ||
        current.privacyAccepted !== previous.privacyAccepted
      ) {
        this.store.dispatch(StartActions.formChanged({ changes: current }));
        previous = current;
      }
    });
  }

  submit(): void {
    this.form.email().markAsTouched();
    this.form.privacyAccepted().markAsTouched();
    if (!this.form().valid()) return;

    const email = this.storeForm()?.email ?? untracked(this.model).email;
    this.store.dispatch(
      StartActions.submit({ email, language: this.translate.getCurrentLang() ?? 'de' }),
    );
  }
}
