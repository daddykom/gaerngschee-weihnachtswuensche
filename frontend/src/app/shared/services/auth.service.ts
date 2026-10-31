import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FairgateStatus } from '../models/fairgate.model';
import { UserGroup } from '../models/frontend-config.model';

export interface AuthUser {
  id: string;
  email: string;
  group: UserGroup;
}

export interface LoginResponse {
  user: AuthUser;
  group: UserGroup;
  requiredPasswordReset: boolean;
  firstAccess: boolean;
}

export interface RegistrationLoginResponse extends LoginResponse {
  fairgateStatus?: FairgateStatus;
  fairgateUserExists: boolean;
  childrenCount: number;
  adultsCount: number;
  salutation: string;
}

export type FulfillerRegistrationResponse = LoginResponse;

export type EmailCheckMode = 'password' | 'email_sent' | 'info';

export interface EmailCheckResponse {
  mode: EmailCheckMode;
  processingYear: number;
}

export interface SessionStatusResponse {
  expiresAt: string;
  secondsRemaining: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    details: Record<string, unknown>;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.apiUrl}/auth/login`,
      { email, password },
      { withCredentials: true },
    );
  }

  checkEmail(email: string): Observable<EmailCheckResponse> {
    return this.http.post<EmailCheckResponse>(
      `${environment.apiUrl}/auth/email-check`,
      { email },
      { withCredentials: true },
    );
  }

  registrationLogin(token: string): Observable<RegistrationLoginResponse> {
    return this.http.post<RegistrationLoginResponse>(
      `${environment.apiUrl}/auth/registration-login`,
      { token },
      { withCredentials: true },
    );
  }

  fulfillerRegistrationLogin(token: string): Observable<FulfillerRegistrationResponse> {
    return this.http.post<FulfillerRegistrationResponse>(
      `${environment.apiUrl}/auth/fulfiller-registration-login`,
      { token },
      { withCredentials: true },
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  sessionStatus(): Observable<SessionStatusResponse> {
    return this.http.get<SessionStatusResponse>(`${environment.apiUrl}/auth/session-status`, {
      withCredentials: true,
    });
  }

  refreshSession(): Observable<SessionStatusResponse> {
    return this.http.post<SessionStatusResponse>(
      `${environment.apiUrl}/auth/session-refresh`,
      {},
      { withCredentials: true },
    );
  }

  changePassword(password: string): Observable<{ user: AuthUser }> {
    return this.http.post<{ user: AuthUser }>(
      `${environment.apiUrl}/auth/password-change-authenticated`,
      { password },
      { withCredentials: true },
    );
  }

  requestPasswordReset(email: string): Observable<{ sent: boolean }> {
    return this.http.post<{ sent: boolean }>(`${environment.apiUrl}/auth/password-reset-request`, {
      email,
    });
  }

  resetPassword(token: string, password: string): Observable<{ user: AuthUser }> {
    return this.http.post<{ user: AuthUser }>(`${environment.apiUrl}/auth/password-reset`, {
      token,
      password,
    });
  }
}
