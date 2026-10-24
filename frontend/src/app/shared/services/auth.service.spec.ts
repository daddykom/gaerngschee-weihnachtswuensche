import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('posts login credentials to the backend', () => {
    const response = {
      user: { id: 'user-123', email: 'user@example.com', group: 'admin' as const },
      group: 'admin' as const,
      requiredPasswordReset: false,
    };
    let actualResponse = null;

    service.login('user@example.com', 'secret').subscribe((value) => {
      actualResponse = value;
    });

    const request = httpTesting.expectOne('http://localhost:8083/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'user@example.com', password: 'secret' });
    request.flush(response);

    expect(actualResponse).toEqual(response);
  });

  it('posts logout to the backend', () => {
    let completed = false;

    service.logout().subscribe({
      complete: () => {
        completed = true;
      },
    });

    const request = httpTesting.expectOne('http://localhost:8083/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(null);

    expect(completed).toBe(true);
  });

  it('exchanges a registration token for a client session', () => {
    const response = {
      user: { id: 'client-123', email: 'person@example.com', group: 'wunschbesteller' as const },
      group: 'wunschbesteller' as const,
      requiredPasswordReset: false,
      fairgateUserExists: true,
      childrenCount: 2,
      adultsCount: 2,
      salutation: 'Hallo',
    };
    let actualResponse = null;

    service.registrationLogin('registration-token').subscribe((value) => {
      actualResponse = value;
    });

    const request = httpTesting.expectOne('http://localhost:8083/auth/registration-login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'registration-token' });
    request.flush(response);

    expect(actualResponse).toEqual(response);
  });

  it('posts the new password to the authenticated password-change endpoint', () => {
    const response = {
      user: { id: 'user-123', email: 'user@example.com', group: 'admin' as const },
    };
    let actualResponse = null;

    service.changePassword('new-secret').subscribe((value) => {
      actualResponse = value;
    });

    const request = httpTesting.expectOne(
      'http://localhost:8083/auth/password-change-authenticated',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ password: 'new-secret' });
    request.flush(response);

    expect(actualResponse).toEqual(response);
  });
});
