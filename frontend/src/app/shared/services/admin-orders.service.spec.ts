import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminOrdersService } from './admin-orders.service';

describe('AdminOrdersService', () => {
  let service: AdminOrdersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminOrdersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('serializes multiple filters as query parameter arrays', () => {
    service.list(['released', 'in_review'], ['gift', 'voucher']).subscribe();

    const request = httpTesting.expectOne((candidate) => candidate.url === 'http://localhost:8083/admin/orders');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.getAll('status[]')).toEqual(['released', 'in_review']);
    expect(request.request.params.getAll('category[]')).toEqual(['gift', 'voucher']);
    expect(request.request.params.getAll('status')).toBeNull();
    expect(request.request.params.getAll('category')).toBeNull();
    request.flush({ orders: [], statuses: [], categories: [] });
  });
});
