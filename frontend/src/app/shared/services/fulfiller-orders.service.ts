import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FulfillerCategory,
  FulfillerOrdersResponse,
  ReserveWishResponse,
} from '../models/fulfiller-order.model';

@Injectable({ providedIn: 'root' })
export class FulfillerOrdersService {
  private readonly http = inject(HttpClient);

  list(search: string, category: FulfillerCategory | ''): Observable<FulfillerOrdersResponse> {
    let params = new HttpParams();
    if (search.trim().length >= 3) {
      params = params.set('q', search.trim());
    }
    if (category !== '') {
      params = params.set('category', category);
    }

    return this.http.get<FulfillerOrdersResponse>(`${environment.apiUrl}/fulfiller/orders`, {
      params,
      withCredentials: true,
    });
  }

  reserve(itemId: string): Observable<ReserveWishResponse> {
    return this.http.post<ReserveWishResponse>(
      `${environment.apiUrl}/fulfiller/order-items/${itemId}/reserve`,
      {},
      { withCredentials: true },
    );
  }
}
