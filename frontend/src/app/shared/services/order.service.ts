import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderOverviewResponse } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  loadOverview(): Observable<OrderOverviewResponse> {
    return this.http.get<OrderOverviewResponse>(`${environment.apiUrl}/client/order`, {
      withCredentials: true,
    });
  }
}
