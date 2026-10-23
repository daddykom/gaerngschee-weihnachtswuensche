import { Component, effect, inject, signal, untracked } from '@angular/core';
import {
  applyEach,
  FieldTree,
  form,
  FormField,
  maxLength,
  SchemaPath,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlErrorComponent } from '../../../../shared/components/control-error/control-error';
import { inputLimits } from '../../../../shared/constants/input-limits';
import { FrontendConfig } from '../../../../shared/models/frontend-config.model';
import { FrontendConfigActions } from '../../../../store/frontend-config/frontend-config.actions';
import {
  selectFrontendConfigLoading,
  selectFrontendConfigs,
  selectFrontendConfigSaving,
} from '../../../../store/frontend-config/frontend-config.feature';

@Component({
  selector: 'app-admin-configuration',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormField,
    TranslatePipe,
    ControlErrorComponent,
  ],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.scss',
})
export class ConfigurationComponent {
  private readonly store = inject(Store);

  readonly configs = this.store.selectSignal(selectFrontendConfigs);
  readonly loading = this.store.selectSignal(selectFrontendConfigLoading);
  readonly saving = this.store.selectSignal(selectFrontendConfigSaving);
  readonly model = signal<Record<string, string | string[]>>({});
  readonly form = form(this.model, (schema) => {
    this.configs().forEach((config) => {
      const regex = config.pattern ? createPattern(config.pattern) : null;

      if (Array.isArray(config.value)) {
        applyEach(schema[config.id] as unknown as SchemaPath<string[]>, (item) => {
          maxLength(item, inputLimits.configurationValue);
          if (regex !== null) {
            validate(item, ({ value }) => (regex.test(value()) ? undefined : { kind: 'pattern' }));
          }
        });
      } else {
        maxLength(
          schema[config.id] as unknown as SchemaPath<string>,
          inputLimits.configurationValue,
        );
        if (regex !== null) {
          validate(schema[config.id] as unknown as SchemaPath<string>, ({ value }) =>
            regex.test(value()) ? undefined : { kind: 'pattern' },
          );
        }
      }
    });
  });

  constructor() {
    effect(() => this.syncForm(this.configs()));
  }

  isArray(config: FrontendConfig): boolean {
    return Array.isArray(config.value);
  }

  values(config: FrontendConfig): string[] {
    return this.model()[config.id] as string[];
  }

  field(config: FrontendConfig): FieldTree<string> {
    return this.form[config.id] as unknown as FieldTree<string>;
  }

  arrayField(config: FrontendConfig, index: number): FieldTree<string> {
    return (this.form[config.id] as unknown as FieldTree<string[]>)[index] as FieldTree<string>;
  }

  addValue(config: FrontendConfig): void {
    if (this.values(config).length >= inputLimits.configurationValues) {
      return;
    }

    this.model.update((model) => ({
      ...model,
      [config.id]: [...(model[config.id] as string[]), ''],
    }));
  }

  removeValue(config: FrontendConfig, index: number): void {
    this.model.update((model) => ({
      ...model,
      [config.id]: (model[config.id] as string[]).filter((_, valueIndex) => valueIndex !== index),
    }));
  }

  onSubmit(): void {
    if (this.saving()) {
      return;
    }

    if (!this.form()['valid']()) {
      this.configs().forEach((config) => {
        if (this.isArray(config)) {
          this.values(config).forEach((_, index) =>
            this.arrayField(config, index)().markAsTouched(),
          );
        } else {
          this.field(config)().markAsTouched();
        }
      });
      return;
    }

    const values = this.configs()
      .filter((config) => config.canUpdate)
      .map((config) => ({
        id: config.id,
        value: this.model()[config.id],
      }));

    this.store.dispatch(FrontendConfigActions.save({ configs: values }));
  }

  private syncForm(configs: FrontendConfig[]): void {
    const currentModel = untracked(this.model);
    const values = configs.reduce<Record<string, string | string[]>>(
      (model, config) => ({
        ...model,
        [config.id]:
          currentModel[config.id] ??
          (Array.isArray(config.value) ? [...config.value] : (config.value ?? '')),
      }),
      {},
    );
    this.model.set(values);
  }
}

function createPattern(source: string): RegExp | null {
  try {
    return new RegExp(`^(?:${source})$`, 'u');
  } catch {
    return null;
  }
}
