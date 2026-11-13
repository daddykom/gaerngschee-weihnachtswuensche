import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { GiftReceiptService } from './gift-receipt.service';

describe('GiftReceiptService', () => {
  let service: GiftReceiptService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GiftReceiptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('looks up the encoded number using a credentialed GET request', () => {
    service.lookup('12-3').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/user/gift-receipts/12-3`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ selectedItemId: 'item-3' });
  });
});
