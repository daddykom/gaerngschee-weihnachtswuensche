import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FulfillerRegistrationResponse {
  sent: boolean;
}

@Injectable({ providedIn: 'root' })
export class FulfillerRegistrationService {
  private readonly http = inject(HttpClient);

  requestLink(
    email: string,
    language: string,
    privacyAccepted: boolean,
  ): Observable<FulfillerRegistrationResponse> {
    return this.http.post<FulfillerRegistrationResponse>(
      `${environment.apiUrl}/public/fulfiller-start`,
      { email, language, privacyAccepted },
      { withCredentials: true },
    );
  }
}
