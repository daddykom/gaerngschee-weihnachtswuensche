import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminStatisticsService } from './admin-statistics.service';

describe('AdminStatisticsService', () => {
  it('loads campaign aggregates with credentials and without list filters', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    TestBed.inject(AdminStatisticsService).load().subscribe();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('http://localhost:8083/admin/statistics');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ year: 2026 });
    http.verify();
  });
});
