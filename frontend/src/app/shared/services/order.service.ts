import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderFormValue, OrderOverviewResponse, SaveOrderResponse } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  loadOverview(): Observable<OrderOverviewResponse> {
    return this.http.get<OrderOverviewResponse>(`${environment.apiUrl}/client/order`, {
      withCredentials: true,
    });
  }

  save(form: OrderFormValue): Observable<SaveOrderResponse> {
    return this.http.post<SaveOrderResponse>(`${environment.apiUrl}/client/order`, form, {
      withCredentials: true,
    });
  }
}
