import { HttpClient, HttpEvent } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderItemImageState } from '../models/order-item-image.model';

@Service()
export class OrderItemImagesService {
  private readonly http = inject(HttpClient);

  metadata(orderId: string, itemId: string): Observable<OrderItemImageState> {
    return this.http.get<OrderItemImageState>(`${this.url(orderId, itemId)}/metadata`, {
      withCredentials: true,
    });
  }

  image(orderId: string, itemId: string): Observable<Blob> {
    return this.http.get(this.url(orderId, itemId), {
      responseType: 'blob',
      withCredentials: true,
    });
  }

  upload(
    orderId: string,
    itemId: string,
    revision: number,
    file: File,
  ): Observable<HttpEvent<OrderItemImageState>> {
    const body = new FormData();
    body.append('revision', String(revision));
    body.append('image', file, file.name);
    return this.http.post<OrderItemImageState>(this.url(orderId, itemId), body, {
      observe: 'events',
      reportProgress: true,
      withCredentials: true,
    });
  }

  remove(orderId: string, itemId: string, revision: number): Observable<OrderItemImageState> {
    return this.http.delete<OrderItemImageState>(this.url(orderId, itemId), {
      body: { revision },
      withCredentials: true,
    });
  }

  private url(orderId: string, itemId: string): string {
    return `${environment.apiUrl}/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/image`;
  }
}
