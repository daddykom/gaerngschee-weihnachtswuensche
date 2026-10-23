import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FairgateTestService } from './fairgate-test.service';

describe('FairgateTestService', () => {
  let service: FairgateTestService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(FairgateTestService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests the Fairgate test result', () => {
    const response = { email: 'person@example.com', fairgate: { success: true } };
    service.test().subscribe((value) => expect(value).toEqual(response));

    const request = httpTesting.expectOne('http://localhost:8083/admin/fairgate/test');
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });
});
