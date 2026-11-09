import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminOrder } from '../models/admin-order.model';

export interface AdminOrderListResponse {
  orders: AdminOrder[];
  statuses: string[];
  categories: string[];
}

export type AdminOrderAction = 'save' | 'release' | 'rejectOrder' | 'acceptItem' | 'rejectItem';

export interface AdminOrderUpdateResponse {
  order: AdminOrder;
  mailSent: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/orders`;

  list(statuses: string[], categories: string[]): Observable<AdminOrderListResponse> {
    let params = new HttpParams();
    statuses.forEach((status) => (params = params.append('status[]', status)));
    categories.forEach((category) => (params = params.append('category[]', category)));
    return this.http.get<AdminOrderListResponse>(this.baseUrl, { params, withCredentials: true });
  }

  update(
    order: AdminOrder,
    action: AdminOrderAction = 'save',
  ): Observable<AdminOrderUpdateResponse> {
    return this.http.patch<AdminOrderUpdateResponse>(
      `${this.baseUrl}/${order.id}`,
      {
        order: {
          id: order.id,
          status: order.status,
          currentText: order.currentText,
          adminNotes: order.adminNotes,
          adultsCount: order.adultsCount,
          childrenCount: order.childrenCount,
        },
        items: order.items.map((item) => ({
          id: item.id,
          category: item.category,
          personType: item.personType,
          personIndex: item.personIndex,
          currentTitle: item.currentTitle,
          currentDescription: item.currentDescription,
          currentReason: item.currentReason,
          personalMessage: item.personalMessage,
          giftLink: item.giftLink,
          publicationStatus: item.publicationStatus,
          adminNotes: item.adminNotes,
        })),
        action,
      },
      { withCredentials: true },
    );
  }
}
