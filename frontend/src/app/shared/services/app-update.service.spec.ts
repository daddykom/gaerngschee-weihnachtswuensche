import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideStore, Store } from '@ngrx/store';
import { Subject, tap } from 'rxjs';
import { BUILD_INFO } from '../../../generated/build-info';
import { AppUpdateActions, appUpdateFeature } from '../../store/app-update/app-update.feature';
import { AppUpdateService, isBuildInfo, RELOAD_APPLICATION } from './app-update.service';

describe('AppUpdateService', () => {
  let http: HttpTestingController;
  let service: AppUpdateService;
  let result: Subject<boolean | undefined>;
  let events: Subject<NavigationEnd>;
  let actions: Subject<ReturnType<typeof AppUpdateActions.buildHintReceived>>;
  let data: Record<string, unknown>;
  let open: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    data = {};
    result = new Subject();
    events = new Subject();
    actions = new Subject();
    const openDialogs: unknown[] = [];
    open = vi.fn(() => {
      const reference = { afterClosed: () => result.pipe(tap(() => openDialogs.splice(0))) };
      openDialogs.push(reference);
      return reference;
    });
    reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore({ appUpdate: appUpdateFeature.reducer }),
        provideMockActions(() => actions),
        { provide: MatDialog, useValue: { open, openDialogs } },
        { provide: Router, useValue: { events, routerState: { snapshot: { root: { data } } } } },
        { provide: RELOAD_APPLICATION, useValue: reload },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AppUpdateService);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  const respond = (buildId = 'new-build') => {
    const request = http.expectOne((request) => request.url === '/build-info.json');
    expect(request.request.headers.get('Cache-Control')).toBe('no-cache');
    request.flush({ appVersion: BUILD_INFO.appVersion, buildId });
  };

  it('keeps the compiled baseline and treats the first different server response as an update', async () => {
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    respond();
    expect(service.pendingBuildId()).toBe('new-build');
    expect(open).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers an update only at an explicitly safe route and never reloads without consent', async () => {
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    respond();
    data['updatePromptAllowed'] = true;
    events.next(new NavigationEnd(1, '/', '/'));
    expect(open).toHaveBeenCalledTimes(1);
    respond();
    expect(reload).not.toHaveBeenCalled();
    result.next(true);
    expect(reload).toHaveBeenCalledTimes(1);
    service.requestReload();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it.each([false, undefined])(
    'allows continuing after dismissing the dialog with %s',
    async (choice) => {
      data['updatePromptAllowed'] = true;
      service.start();
      await vi.advanceTimersByTimeAsync(0);
      respond();
      result.next(choice);
      await vi.advanceTimersByTimeAsync(60_000);
      respond();
      expect(open).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      expect(service.pendingBuildId()).toBe('new-build');
      service.requestReload();
      expect(open).toHaveBeenCalledTimes(2);
    },
  );

  it('remembers later for the same running build across page reloads', async () => {
    sessionStorage.setItem(`gaerngschee.update-deferred:${BUILD_INFO.buildId}`, 'new-build');
    data['updatePromptAllowed'] = true;
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    respond();
    expect(service.pendingBuildId()).toBe('new-build');
    expect(open).not.toHaveBeenCalled();
  });

  it('ignores same-build, malformed and unavailable metadata and keeps checking', async () => {
    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    respond(BUILD_INFO.buildId);
    expect(service.pendingBuildId()).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    http
      .expectOne((request) => request.url === '/build-info.json')
      .flush('<html>SPA fallback</html>');
    expect(service.pendingBuildId()).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    http
      .expectOne((request) => request.url === '/build-info.json')
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(60_000);
    respond();
    expect(service.pendingBuildId()).toBe('new-build');
  });

  it('verifies a backend header against the frontend artifact before offering a reload', async () => {
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    respond(BUILD_INFO.buildId);
    actions.next(AppUpdateActions.buildHintReceived({ buildId: 'backend-ahead' }));
    respond(BUILD_INFO.buildId);
    expect(service.pendingBuildId()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('validates build identifiers separately from the release number', () => {
    expect(isBuildInfo({ appVersion: '1.2.3+42', buildId: 'new-build' })).toBe(true);
    expect(isBuildInfo({ appVersion: '1.2.3+42', buildId: 42 })).toBe(false);
    const store = TestBed.inject(Store);
    store.dispatch(AppUpdateActions.buildDetected({ buildId: 'new-build' }));
    store.dispatch(AppUpdateActions.buildDetected({ buildId: BUILD_INFO.buildId }));
    expect(service.pendingBuildId()).toBeNull();
  });
});
