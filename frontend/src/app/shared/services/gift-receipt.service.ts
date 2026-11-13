import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GiftReceiptResponse, GiftReceiptResult } from '../models/gift-receipt.model';

@Injectable({ providedIn: 'root' })
export class GiftReceiptService {
  private readonly http = inject(HttpClient);

  lookup(giftNumber: string): Observable<GiftReceiptResult> {
    return this.http.get<GiftReceiptResult>(
      `${environment.apiUrl}/user/gift-receipts/${encodeURIComponent(giftNumber)}`,
      { withCredentials: true },
    );
  }

  receive(
    giftNumber: string,
    confirmUnreserved: boolean,
    confirmPickup: boolean,
  ): Observable<GiftReceiptResponse> {
    return this.http.post<GiftReceiptResponse>(
      `${environment.apiUrl}/user/gift-receipts/${encodeURIComponent(giftNumber)}`,
      { confirmUnreserved, confirmPickup },
      { withCredentials: true },
    );
  }
}
