import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { FrontendConfig } from '../../../../shared/models/frontend-config.model';
import { FrontendConfigActions } from '../../../../store/frontend-config/frontend-config.actions';
import { ConfigurationComponent } from './configuration.component';

describe('ConfigurationComponent', () => {
  let component: ConfigurationComponent;
  let fixture: ComponentFixture<ConfigurationComponent>;
  let store: MockStore;

  const configs: FrontendConfig[] = [
    {
      id: 'scalar-config',
      variableName: 'SCALAR_CONFIG',
      value: '120',
      description: 'Einzelwert',
      accessGroup: ['admin'],
      updateGroup: ['admin'],
      label: 'Einzelwert',
      pattern: '^\\d+$',
      placeholder: 'z. B. 120',
      canUpdate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'array-config',
      variableName: 'ARRAY_CONFIG',
      value: ['A', 'B'],
      description: 'Mehrere Werte',
      accessGroup: ['admin'],
      updateGroup: ['admin'],
      label: 'Mehrere Werte',
      pattern: null,
      placeholder: null,
      canUpdate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'readonly-config',
      variableName: 'READONLY_CONFIG',
      value: 'nur lesen',
      description: '',
      accessGroup: ['admin'],
      updateGroup: [],
      label: 'Nur lesen',
      pattern: null,
      placeholder: null,
      canUpdate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigurationComponent],
      providers: [
        provideTranslateService(),
        provideMockStore({
          initialState: {
            frontendConfig: {
              configs,
              loadStatus: 'success',
              saveStatus: 'initial',
              errorCode: null,
            },
          },
        }),
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(ConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads and displays scalar and array configuration values', () => {
    expect(fixture.nativeElement.textContent).toContain('SCALAR_CONFIG');
    expect(fixture.nativeElement.textContent).toContain('ARRAY_CONFIG');
    expect(component.model()[configs[0].id]).toBe('120');
    expect(component.model()[configs[1].id]).toEqual(['A', 'B']);
  });

  it('disables fields without update permission', () => {
    expect(fixture.nativeElement.querySelector('input[disabled]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.configuration-field--readonly')).toBeTruthy();
  });

  it('adds and removes array values', () => {
    component.addValue(configs[1]);
    expect(component.values(configs[1])).toHaveLength(3);

    component.removeValue(configs[1], 1);
    expect(component.model()[configs[1].id]).toEqual(['A', '']);
  });

  it('dispatches editable scalar and array values when saving', () => {
    const dispatch = vi.spyOn(store, 'dispatch');
    component.model.update((model) => ({
      ...model,
      [configs[0].id]: '240',
      [configs[1].id]: ['C', 'B'],
    }));

    component.onSubmit();

    expect(dispatch).toHaveBeenCalledWith(
      FrontendConfigActions.save({
        configs: [
          { id: 'scalar-config', value: '240' },
          { id: 'array-config', value: ['C', 'B'] },
        ],
      }),
    );
  });

  it('blocks values that do not match the configured pattern', () => {
    component.model.update((model) => ({ ...model, [configs[0].id]: 'not-a-number' }));
    component.form()['markAsTouched']();

    expect(component.form()['valid']()).toBe(false);
    expect(component.field(configs[0])().errors()[0]?.kind).toBe('pattern');
  });

  it('shows a pattern error after submitting an invalid value', () => {
    component.model.update((model) => ({ ...model, [configs[0].id]: 'not-a-number' }));
    component.onSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.control-error')?.textContent).toContain(
      'app.admin.configuration.errors.pattern',
    );
  });

  it('shows a pattern error on the field after entering an invalid value and leaving it', async () => {
    const input = fixture.nativeElement.querySelector(
      'input[placeholder="z. B. 120"]',
    ) as HTMLInputElement;
    input.value = 'not-a-number';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const field = input.closest('mat-form-field');

    expect(component.model()[configs[0].id]).toBe('not-a-number');
    expect(field?.querySelector('.control-error')?.textContent).toContain(
      'app.admin.configuration.errors.pattern',
    );
  });

  it('validates the maximum length for configurations without a pattern', () => {
    component.model.update((model) => ({
      ...model,
      [configs[1].id]: ['x'.repeat(1001)],
    }));

    expect(component.form()['valid']()).toBe(false);
    expect(component.arrayField(configs[1], 0)().errors()[0]?.kind).toBe('maxLength');
  });

  it('does not save while a save is already in progress', () => {
    store.setState({
      frontendConfig: {
        configs,
        loadStatus: 'success',
        saveStatus: 'loading',
        errorCode: null,
        publicConfigs: [],
        publicStatus: 'initial',
        publicErrorCode: null,
      },
    });
    const dispatch = vi.spyOn(store, 'dispatch');

    component.onSubmit();

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: FrontendConfigActions.save.type }),
    );
  });

  it('shows the loading state and does not render the form fields', () => {
    store.setState({
      frontendConfig: {
        configs: [],
        loadStatus: 'loading',
        saveStatus: 'initial',
        errorCode: null,
        publicConfigs: [],
        publicStatus: 'initial',
        publicErrorCode: null,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('app.admin.configuration.loading');
    expect(fixture.nativeElement.querySelectorAll('fieldset')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
  });

  it('renders the empty state and supports null scalar values', async () => {
    component.model.set({});
    store.setState({
      frontendConfig: {
        configs: [{ ...configs[0], value: null }],
        loadStatus: 'success',
        saveStatus: 'initial',
        errorCode: null,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.model()[configs[0].id]).toBe('');

    store.setState({
      frontendConfig: {
        configs: [],
        loadStatus: 'success',
        saveStatus: 'initial',
        errorCode: null,
        publicConfigs: [],
        publicStatus: 'initial',
        publicErrorCode: null,
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('app.admin.configuration.empty');
  });

  it('removes controls for configurations no longer in the store', async () => {
    store.setState({
      frontendConfig: {
        configs: [configs[0]],
        loadStatus: 'success',
        saveStatus: 'initial',
        errorCode: null,
        publicConfigs: [],
        publicStatus: 'initial',
        publicErrorCode: null,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.model()[configs[1].id]).toBeUndefined();
    expect(component.model()[configs[0].id]).toBe('120');
  });
});
