import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FrontendConfigService } from './frontend-config.service';

describe('FrontendConfigService', () => {
  let service: FrontendConfigService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(FrontendConfigService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists frontend configuration', () => {
    const response = [{ id: 'site_name' }];
    service.list().subscribe((value) => expect(value).toEqual(response));

    const request = httpTesting.expectOne('http://localhost:8083/admin/configuration');
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });

  it('lists public frontend configuration', () => {
    const response = [{ variableName: 'fairgate_url', value: 'https://fairgate.example' }];
    service.listPublic().subscribe((value) => expect(value).toEqual(response));

    const request = httpTesting.expectOne('http://localhost:8083/public/configuration');
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });

  it('updates a configuration value', () => {
    service.update('languages', ['de', 'fr']).subscribe();

    const request = httpTesting.expectOne('http://localhost:8083/admin/configuration/languages');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ value: ['de', 'fr'] });
    request.flush({ id: 'languages' });
  });
});
