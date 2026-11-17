import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminStatistics } from '../models/admin-statistics.model';

@Injectable({ providedIn: 'root' })
export class AdminStatisticsService {
  private readonly http = inject(HttpClient);

  load(): Observable<AdminStatistics> {
    return this.http.get<AdminStatistics>(`${environment.apiUrl}/admin/statistics`, {
      withCredentials: true,
    });
  }
}
