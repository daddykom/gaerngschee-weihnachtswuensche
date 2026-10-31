import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FulfillerCategory,
  FulfillerOrdersResponse,
  FulfillerReservationResponse,
  FulfillerWish,
  FulfillerWishStatusesResponse,
} from '../models/fulfiller-order.model';

export interface FulfillerReservationConfirmationResponse {
  wish: FulfillerWish;
  handover: {
    date: string | string[] | null;
    time: string | string[] | null;
    location: string | string[] | null;
  };
}

export interface FulfillerAvailabilityVersionResponse {
  version: number;
}

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

    return this.http.get<FulfillerOrdersResponse>(`${environment.apiUrl}/public/fulfiller/orders`, {
      params,
    });
  }

  requestReservation(
    itemId: string,
    email: string,
    privacyAccepted: boolean,
  ): Observable<FulfillerReservationResponse> {
    return this.http.post<FulfillerReservationResponse>(
      `${environment.apiUrl}/public/fulfiller-reservation-start`,
      { itemId, email, privacyAccepted, language: 'de' },
    );
  }

  availabilityVersion(): Observable<FulfillerAvailabilityVersionResponse> {
    return this.http.get<FulfillerAvailabilityVersionResponse>(
      `${environment.apiUrl}/public/fulfiller/availability-version`,
    );
  }

  statuses(): Observable<FulfillerWishStatusesResponse> {
    return this.http.get<FulfillerWishStatusesResponse>(
      `${environment.apiUrl}/public/fulfiller/wish-statuses`,
    );
  }

  confirmReservation(token: string): Observable<FulfillerReservationConfirmationResponse> {
    return this.http.post<FulfillerReservationConfirmationResponse>(
      `${environment.apiUrl}/auth/fulfiller-reservation-confirm`,
      { token },
    );
  }
}
