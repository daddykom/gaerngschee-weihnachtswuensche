import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { form, required } from '@angular/forms/signals';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ControlErrorComponent } from './control-error';

@Component({
  imports: [ReactiveFormsModule, ControlErrorComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: ` <app-control-error [control]="control" translationPrefix="errors.email" /> `,
})
class TestHostComponent {
  control = new FormControl('', [Validators.required, Validators.email]);
}

@Component({
  imports: [ControlErrorComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '<app-control-error [control]="form.email()" translationPrefix="errors.email" />',
})
class SignalTestHostComponent {
  model = signal({ email: '' });
  form = form(this.model, (schema) => required(schema.email));
}

describe('ControlErrorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideTranslateService()],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('de', {
      errors: {
        email: {
          required: 'E-Mail ist erforderlich.',
          email: 'E-Mail ist ungültig.',
        },
      },
    });
    TestBed.inject(TranslateService).use('de');

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('does not show an error before the control is touched', () => {
    host.control.setValue('invalid-email');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.control-error')).toBeNull();
  });

  it('shows the translated first error after the control is touched', () => {
    host.control.markAsTouched();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.control-error').textContent).toContain(
      'E-Mail ist erforderlich.',
    );
  });

  it('shows only the first error when multiple errors exist', () => {
    host.control.setErrors({ required: true, email: true });
    host.control.markAsTouched();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('.control-error');
    expect(error.textContent).toContain('E-Mail ist erforderlich.');
    expect(error.textContent).not.toContain('E-Mail ist ungültig.');
  });

  it('does not show a required signal-form error before the field is touched', () => {
    const signalFixture = TestBed.createComponent(SignalTestHostComponent);
    signalFixture.detectChanges();

    expect(signalFixture.nativeElement.querySelector('.control-error')).toBeNull();
  });

  it('shows a required signal-form error after the field is touched', () => {
    const signalFixture = TestBed.createComponent(SignalTestHostComponent);
    signalFixture.detectChanges();
    signalFixture.componentInstance.form.email().markAsTouched();
    signalFixture.detectChanges();

    expect(signalFixture.nativeElement.querySelector('.control-error')).not.toBeNull();
  });
});
