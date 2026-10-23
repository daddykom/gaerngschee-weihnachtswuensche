import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnmeldungService } from './anmeldung.service';

describe('AnmeldungService', () => {
  let service: AnmeldungService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnmeldungService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests information for an email and language', () => {
    const response = { sent: true };
    let actualResponse = null;

    service.requestInformation('person@example.com', 'de').subscribe((value) => {
      actualResponse = value;
    });

    const request = httpTesting.expectOne('http://localhost:8083/public/start');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'person@example.com', language: 'de' });
    request.flush(response);

    expect(actualResponse).toEqual(response);
  });
});
