import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { StartActions } from '../../../../store/start/start.actions';
import { WeihnachtswuenscheStartComponent } from './weihnachtswuensche-start.component';

describe('WeihnachtswuenscheStartComponent', () => {
  const store = {
    dispatch: vi.fn(),
    selectSignal: vi.fn().mockReturnValue(signal(false)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    store.selectSignal.mockReturnValue(signal(false));

    await TestBed.configureTestingModule({
      imports: [WeihnachtswuenscheStartComponent],
      providers: [{ provide: Store, useValue: store }, provideTranslateService()],
    }).compileComponents();
  });

  it('does not dispatch for an invalid email', () => {
    const fixture = TestBed.createComponent(WeihnachtswuenscheStartComponent);
    const component = fixture.componentInstance;
    component.model.set({ email: 'invalid-email' });

    component.submit();

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(component.form.email().touched()).toBe(true);
  });

  it('dispatches the email in the submit action', () => {
    const fixture = TestBed.createComponent(WeihnachtswuenscheStartComponent);
    const component = fixture.componentInstance;
    component.model.set({ email: 'person@example.com' });

    component.submit();

    expect(store.dispatch).toHaveBeenCalledWith(
      StartActions.submit({ email: 'person@example.com', language: 'de' }),
    );
  });

});
