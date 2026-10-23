import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FairgateTestResult } from './fairgate-test.service';

@Injectable({ providedIn: 'root' })
export class FairgateLookupService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/fairgate-lookup`;

  lookup(email: string, membership?: string): Observable<FairgateTestResult> {
    return this.http.get<FairgateTestResult>(this.url, {
      params: membership ? { email, membership } : { email },
      withCredentials: true,
    });
  }
}
