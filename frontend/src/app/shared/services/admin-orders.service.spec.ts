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

  it('serializes the complete order draft and action for updates', () => {
    const order = {
      id: 'order-1',
      status: 'definitive',
      currentText: 'Aktueller Text',
      adminNotes: 'Geprüft',
      adultsCount: 2,
      childrenCount: 1,
      items: [{
        id: 'item-1',
        currentDescription: 'Beschreibung',
        currentReason: 'Begründung',
        publicationStatus: 'approved',
        adminNotes: null,
      }],
    } as never;

    service.update(order, 'release').subscribe();

    const request = httpTesting.expectOne('http://localhost:8083/admin/orders/order-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      order: {
        id: 'order-1',
        status: 'definitive',
        currentText: 'Aktueller Text',
        adminNotes: 'Geprüft',
        adultsCount: 2,
        childrenCount: 1,
      },
      items: [{
        id: 'item-1',
        currentDescription: 'Beschreibung',
        currentReason: 'Begründung',
        publicationStatus: 'approved',
        adminNotes: null,
      }],
      action: 'release',
    });
    request.flush({ order });
  });
});
