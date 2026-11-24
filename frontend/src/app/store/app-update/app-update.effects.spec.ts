import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideEffects } from '@ngrx/effects';
import { provideStore, Store } from '@ngrx/store';
import { Subject, tap } from 'rxjs';
import { BUILD_INFO } from '../../../generated/build-info';
import { appUpdateEffects, RELOAD_APPLICATION } from './app-update.effects';
import { AppUpdateActions, appUpdateFeature } from './app-update.feature';

describe('appUpdateEffects', () => {
  const storageKey = `gaerngschee.update-deferred:${BUILD_INFO.buildId}`;
  let result: Subject<unknown>;
  let openDialogs: unknown[];
  let open: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    result = new Subject();
    openDialogs = [];
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
        provideEffects(appUpdateEffects),
        { provide: MatDialog, useValue: { open, openDialogs } },
        { provide: RELOAD_APPLICATION, useValue: reload },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const detect = (buildId = 'new-build') =>
    TestBed.inject(Store).dispatch(AppUpdateActions.buildDetected({ buildId }));

  const state = () => TestBed.inject(Store).selectSignal(appUpdateFeature.selectAppUpdateState)();

  it('offers a detected build globally and reloads only after explicit confirmation', () => {
    detect();
    expect(state().pendingBuildId).toBe('new-build');
    expect(open).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    detect();
    TestBed.inject(Store).dispatch(AppUpdateActions.reloadClicked());
    expect(open).toHaveBeenCalledTimes(1);
    reload.mockImplementation(() => {
      expect(sessionStorage.getItem(storageKey)).toBe('new-build');
    });
    result.next(true);
    expect(state().reloading).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    detect();
    TestBed.inject(Store).dispatch(AppUpdateActions.reloadClicked());
    expect(open).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it.each([false, undefined, null, 'true'])(
    'keeps working after dismissing with %s and permits a later manual decision',
    (choice) => {
      detect();
      result.next(choice);
      expect(state().deferredBuildId).toBe('new-build');
      expect(sessionStorage.getItem(storageKey)).toBe('new-build');
      detect();
      expect(open).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      expect(state().pendingBuildId).toBe('new-build');
      TestBed.inject(Store).dispatch(AppUpdateActions.reloadClicked());
      expect(open).toHaveBeenCalledTimes(2);
    },
  );

  it('restores the saved deferral on root effect initialization without a start call', () => {
    sessionStorage.setItem(storageKey, 'new-build');
    detect();
    expect(state().deferredBuildId).toBe('new-build');
    expect(state().pendingBuildId).toBe('new-build');
    expect(open).not.toHaveBeenCalled();
  });

  it('does not overlay another dialog and offers the update on a later response', () => {
    openDialogs.push({});
    detect();
    TestBed.inject(Store).dispatch(AppUpdateActions.reloadClicked());
    expect(open).not.toHaveBeenCalled();
    expect(state().pendingBuildId).toBe('new-build');
    openDialogs.splice(0);
    detect();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('offers a newer build after the previously detected build was deferred', () => {
    detect();
    result.next(false);
    detect('newer-build');
    expect(open).toHaveBeenCalledTimes(2);
    expect(state().pendingBuildId).toBe('newer-build');
    expect(reload).not.toHaveBeenCalled();
  });

  it('records the decision for the build shown in the dialog, not a newer response', () => {
    detect();
    detect('newer-build');
    result.next(false);
    expect(state().pendingBuildId).toBe('newer-build');
    expect(state().deferredBuildId).toBe('new-build');
    expect(sessionStorage.getItem(storageKey)).toBe('new-build');
    detect('newer-build');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('continues detecting and deferring when storage access is disabled', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    detect();
    result.next(false);
    detect();
    expect(state().deferredBuildId).toBe('new-build');
    expect(open).toHaveBeenCalledTimes(1);
    TestBed.inject(Store).dispatch(AppUpdateActions.reloadClicked());
    result.next(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not request metadata at initialization, on a build event, on focus or over time', async () => {
    vi.useFakeTimers();
    detect();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120_000);
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not open a dialog for the running build or a click without a pending update', () => {
    detect(BUILD_INFO.buildId);
    TestBed.inject(Store).dispatch(AppUpdateActions.reloadClicked());
    expect(state().pendingBuildId).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});
