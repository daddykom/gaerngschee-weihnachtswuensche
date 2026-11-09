import { Component, effect, inject, signal } from '@angular/core';
import { email, FieldTree, form, FormField, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import {
  EmailTestField,
  EmailTestForm,
  EmailTestTemplate,
} from '../../../../shared/services/email-test.service';
import { EmailTestActions } from '../../../../store/email-test/email-test.actions';
import {
  selectEmailTestForm,
  selectEmailTestStatus,
  selectEmailTestTemplates,
} from '../../../../store/email-test/email-test.feature';

@Component({
  selector: 'app-admin-email-test',
  imports: [
    ControlErrorComponent,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './email-test.component.html',
  styleUrl: './email-test.component.scss',
})
export class EmailTestComponent {
  private readonly store = inject(Store);
  private readonly storeForm = this.store.selectSignal(selectEmailTestForm);
  readonly templates = this.store.selectSignal(selectEmailTestTemplates);
  readonly status = this.store.selectSignal(selectEmailTestStatus);
  readonly model = signal<EmailTestForm>({ recipient: '', template: '', parameters: {} });
  readonly form = form(this.model, (schema) => {
    required(schema.recipient);
    email(schema.recipient);
    maxLength(schema.recipient, inputLimits.email);
    required(schema.template);
  });

  constructor() {
    let initialized = false;
    let previous = this.model();
    effect(() => {
      const storeForm = this.storeForm();
      if (!initialized && storeForm !== undefined) {
        this.model.set(storeForm);
        previous = storeForm;
        initialized = true;
      } else if (initialized && this.model().template === '' && storeForm.template !== '') {
        this.model.set(storeForm);
        previous = storeForm;
      }
    });
    effect(() => {
      if (!initialized) return;
      const current = this.model();
      if (JSON.stringify(current) !== JSON.stringify(previous)) {
        this.store.dispatch(EmailTestActions.formChanged({ changes: current }));
        previous = current;
      }
    });
  }

  selectedTemplate(): EmailTestTemplate | undefined {
    return this.templates().find((template) => template.id === this.model().template);
  }

  parameterField(key: string): FieldTree<string> {
    return (this.form.parameters as unknown as Record<string, FieldTree<string>>)[key];
  }

  parameterValue(key: string): string {
    return this.model().parameters[key] ?? '';
  }

  fieldLabel(field: EmailTestField): string {
    return `app.admin.emailTest.parameters.${field.key}`;
  }

  templateLabel(template: EmailTestTemplate): string {
    return `app.admin.emailTest.templates.${template.id}`;
  }

  selectTemplate(template: string): void {
    const definition = this.templates().find((item) => item.id === template);
    const parameters = (definition?.fields ?? []).reduce<Record<string, string>>(
      (values, field) => ({ ...values, [field.key]: this.parameterValue(field.key) }),
      {},
    );
    this.model.update((current) => ({ ...current, template, parameters }));
  }

  submit(): void {
    this.form.recipient().markAsTouched();
    this.form.template().markAsTouched();
    const template = this.selectedTemplate();
    const values = this.model();
    const missing = template?.fields.some(
      (field) => field.required && values.parameters[field.key]?.trim() === '',
    );
    if (!this.form().valid() || missing || this.status() === 'sending') return;
    this.store.dispatch(EmailTestActions.send({ form: values }));
  }
}
