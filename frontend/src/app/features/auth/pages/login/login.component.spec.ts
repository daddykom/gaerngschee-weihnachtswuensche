import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Login } from './login.component';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let store: MockStore;

  const initialState = {
    auth: {
      group: null,
      loading: false,
      emailCheckLoading: false,
      emailCheckMode: null,
      emailCheckEmail: null,
      emailCheckYear: null,
      emailCheckErrorCode: null,
      errorCode: null,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideTranslateService(), provideMockStore({ initialState })],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    fixture.detectChanges();
  });

  it('dispatches login credentials for a valid form', () => {
    component.loginModel.set({ email: 'user@example.com', password: 'secret' });
    store.setState({
      auth: {
        ...initialState.auth,
        emailCheckMode: 'password',
        emailCheckEmail: 'user@example.com',
      },
    });
    fixture.detectChanges();

    component.onSubmit();

    expect(store.dispatch).toHaveBeenCalledWith({
      type: '[Auth] Login',
      email: 'user@example.com',
      password: 'secret',
    });
  });

  it('does not dispatch for an invalid form', () => {
    component.loginModel.set({ email: 'invalid-email', password: '' });

    component.onSubmit();

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(component.loginForm.email().touched()).toBe(true);
    expect(component.loginForm.password().touched()).toBe(false);
  });

  it('shows validation errors after submitting an invalid form', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });

  it('disables the submit button while loading', () => {
    store.setState({ auth: { ...initialState.auth, loading: true } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('dispatches forgot password when the link is clicked', () => {
    store.setState({
      auth: { ...initialState.auth, emailCheckMode: 'password', emailCheckEmail: '' },
    });
    fixture.detectChanges();
    const forgotPassword = fixture.nativeElement.querySelector('.forgot-password-link');

    forgotPassword.click();

    expect(store.dispatch).toHaveBeenCalledWith({
      type: '[Navigation] Navigate',
      target: '/password-reset-request',
    });
  });
});
