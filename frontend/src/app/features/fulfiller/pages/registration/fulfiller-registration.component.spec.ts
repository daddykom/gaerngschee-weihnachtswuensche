import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { FulfillerRegistrationActions } from '../../../../store/fulfiller-registration/fulfiller-registration.actions';
import { FulfillerRegistrationComponent } from './fulfiller-registration.component';

describe('FulfillerRegistrationComponent', () => {
  const store = {
    dispatch: vi.fn(),
    selectSignal: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    store.selectSignal.mockReturnValue(
      signal({ email: '', privacyAccepted: false, language: 'de' }),
    );

    await TestBed.configureTestingModule({
      imports: [FulfillerRegistrationComponent],
      providers: [
        { provide: Store, useValue: store },
        provideRouter([]),
        provideTranslateService(),
      ],
    }).compileComponents();
  });

  it('does not submit without the privacy opt-in', () => {
    const fixture = TestBed.createComponent(FulfillerRegistrationComponent);
    const component = fixture.componentInstance;
    component.model.set({ email: 'giver@example.com', privacyAccepted: false });

    component.submit();

    expect(store.dispatch).not.toHaveBeenCalledWith(
      FulfillerRegistrationActions.submit({
        email: 'giver@example.com',
        privacyAccepted: false,
        language: 'de',
      }),
    );
    expect(component.form.privacyAccepted().touched()).toBe(true);
  });

  it('dispatches the form when the email and privacy opt-in are valid', () => {
    const fixture = TestBed.createComponent(FulfillerRegistrationComponent);
    const component = fixture.componentInstance;
    component.model.set({ email: 'giver@example.com', privacyAccepted: true });

    component.submit();

    expect(store.dispatch).toHaveBeenCalledWith(
      FulfillerRegistrationActions.submit({
        email: 'giver@example.com',
        privacyAccepted: true,
        language: 'de',
      }),
    );
  });
});
