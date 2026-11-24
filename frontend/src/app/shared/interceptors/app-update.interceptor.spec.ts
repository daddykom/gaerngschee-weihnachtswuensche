import {
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { firstValueFrom, of, throwError } from 'rxjs';
import { BUILD_INFO } from '../../../generated/build-info';
import { AppUpdateActions } from '../../store/app-update/app-update.feature';
import { appUpdateInterceptor } from './app-update.interceptor';

describe('appUpdateInterceptor', () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: Store, useValue: { dispatch } }] });
  });

  it('detects a different build and preserves the request, response and domain event headers', async () => {
    const request = new HttpRequest('GET', '/public/configuration');
    const response = new HttpResponse({
      body: { value: 'unchanged' },
      headers: new HttpHeaders({
        'X-App-Build': 'new-build',
        'X-Event-order-status-change': '3',
      }),
    });
    const next = vi.fn(() => of(response));
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => appUpdateInterceptor(request, next)),
    );
    expect(next).toHaveBeenCalledExactlyOnceWith(request);
    expect(result).toBe(response);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      AppUpdateActions.buildDetected({ buildId: 'new-build' }),
    );
  });

  it.each([null, '', BUILD_INFO.buildId, 'invalid build', 'a'.repeat(101)])(
    'ignores missing, unchanged or invalid build headers: %s',
    async (buildId) => {
      const response = new HttpResponse({
        headers: new HttpHeaders(buildId === null ? {} : { 'X-App-Build': buildId }),
      });
      await firstValueFrom(
        TestBed.runInInjectionContext(() =>
          appUpdateInterceptor(new HttpRequest('GET', '/public/configuration'), () => of(response)),
        ),
      );
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it('detects builds on error responses without swallowing or changing the error', async () => {
    const error = new HttpErrorResponse({
      status: 503,
      error: { error: { code: 'UNAVAILABLE' } },
      headers: new HttpHeaders({ 'X-App-Build': 'new-build' }),
    });
    await expect(
      firstValueFrom(
        TestBed.runInInjectionContext(() =>
          appUpdateInterceptor(new HttpRequest('GET', '/public/configuration'), () =>
            throwError(() => error),
          ),
        ),
      ),
    ).rejects.toBe(error);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      AppUpdateActions.buildDetected({ buildId: 'new-build' }),
    );
  });

  it('passes progress events through without detecting a build', async () => {
    const event = { type: HttpEventType.Sent } as const;
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        appUpdateInterceptor(new HttpRequest('GET', '/public/configuration'), () => of(event)),
      ),
    );
    expect(result).toBe(event);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('preserves network errors without a build header', async () => {
    const error = new HttpErrorResponse({ status: 0 });
    await expect(
      firstValueFrom(
        TestBed.runInInjectionContext(() =>
          appUpdateInterceptor(new HttpRequest('GET', '/public/configuration'), () =>
            throwError(() => error),
          ),
        ),
      ),
    ).rejects.toBe(error);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
