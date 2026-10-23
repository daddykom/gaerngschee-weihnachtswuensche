import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FrontendConfig, PublicFrontendConfig } from '../models/frontend-config.model';

@Injectable({ providedIn: 'root' })
export class FrontendConfigService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/configuration`;

  list(): Observable<FrontendConfig[]> {
    return this.http.get<FrontendConfig[]>(this.baseUrl, { withCredentials: true });
  }

  listPublic(): Observable<PublicFrontendConfig[]> {
    return this.http.get<PublicFrontendConfig[]>(`${environment.apiUrl}/public/configuration`);
  }

  update(id: string, value: string | string[]): Observable<FrontendConfig> {
    return this.http.patch<FrontendConfig>(
      `${this.baseUrl}/${id}`,
      { value },
      { withCredentials: true },
    );
  }
}
