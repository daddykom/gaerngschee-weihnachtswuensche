import { HttpEventType, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OrderItemImagesService } from './order-item-images.service';

describe('OrderItemImagesService', () => {
  let service: OrderItemImagesService;
  let http: HttpTestingController;
  const url = 'http://localhost:8083/admin/orders/order-1/items/item-1/image';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrderItemImagesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads image metadata separately with credentials', () => {
    service.metadata('order-1', 'item-1').subscribe();
    const request = http.expectOne(`${url}/metadata`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ revision: 0, image: null });
  });

  it('retrieves the image as a blob without adding binary data to order requests', () => {
    service.image('order-1', 'item-1').subscribe();
    const request = http.expectOne(url);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.withCredentials).toBe(true);
    request.flush(new Blob(['image'], { type: 'image/png' }));
  });

  it('uploads multipart data and exposes progress independently from persistence confirmation', () => {
    const events: number[] = [];
    const file = new File(['image'], 'gift.png', { type: 'image/png' });
    let complete = false;
    service.upload('order-1', 'item-1', 3, file).subscribe({
      next: (event) => events.push(event.type),
      complete: () => (complete = true),
    });
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.reportProgress).toBe(true);
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('revision')).toBe('3');
    const uploaded = request.request.body.get('image') as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe(file.name);
    expect(uploaded.type).toBe(file.type);
    expect(uploaded.size).toBe(file.size);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 5 });
    expect(events).toContain(HttpEventType.UploadProgress);
    expect(complete).toBe(false);
    request.flush({ revision: 4, image: null });
    expect(events).toContain(HttpEventType.Response);
    expect(complete).toBe(true);
  });

  it('removes an image using its revision without changing wish data', () => {
    service.remove('order-1', 'item-1', 7).subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ revision: 7 });
    request.flush({ revision: 8, image: null });
  });

  it('encodes order and item identifiers as individual path segments', () => {
    service.metadata('order/a', 'item/b').subscribe();
    http
      .expectOne('http://localhost:8083/admin/orders/order%2Fa/items/item%2Fb/image/metadata')
      .flush({ revision: 0, image: null });
  });
});
