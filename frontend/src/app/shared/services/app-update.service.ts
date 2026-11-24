import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  EMPTY,
  exhaustMap,
  filter,
  fromEvent,
  merge,
  Subject,
  take,
  timer,
} from 'rxjs';
import { BUILD_INFO } from '../../../generated/build-info';
import { AppUpdateActions, appUpdateFeature } from '../../store/app-update/app-update.feature';
import { AppUpdateDialogComponent } from '../components/app-update-dialog/app-update-dialog.component';

export const RELOAD_APPLICATION = new InjectionToken<() => void>('Reload application', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly actions = inject(Actions);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = inject(RELOAD_APPLICATION);
  private readonly checkRequested = new Subject<void>();
  private readonly storageKey = `gaerngschee.update-deferred:${BUILD_INFO.buildId}`;
  private started = false;
  private reloading = false;
  readonly pendingBuildId = this.store.selectSignal(appUpdateFeature.selectPendingBuildId);
  private readonly deferredBuildId = this.store.selectSignal(
    appUpdateFeature.selectDeferredBuildId,
  );

  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      const buildId = sessionStorage.getItem(this.storageKey);
      if (buildId) this.store.dispatch(AppUpdateActions.reloadDeferred({ buildId }));
    } catch {
      /* Storage can be disabled without disabling updates. */
    }

    merge(
      timer(0, 60_000),
      this.checkRequested,
      fromEvent(this.document, 'visibilitychange').pipe(filter(() => !this.document.hidden)),
      this.document.defaultView ? fromEvent(this.document.defaultView, 'focus') : EMPTY,
    )
      .pipe(
        filter(() => !this.document.hidden),
        exhaustMap(() =>
          this.http
            .get<unknown>('/build-info.json', {
              headers: { 'Cache-Control': 'no-cache' },
              params: { check: String(Date.now()) },
            })
            .pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        if (!isBuildInfo(payload)) return;
        this.store.dispatch(AppUpdateActions.buildDetected({ buildId: payload.buildId }));
        this.offerAtSafeLocation();
      });

    this.actions
      .pipe(ofType(AppUpdateActions.buildHintReceived), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ buildId }) => {
        // Verify the published frontend artifact; a backend may be deployed earlier.
        if (buildId !== BUILD_INFO.buildId && buildId !== this.pendingBuildId())
          this.checkRequested.next();
      });
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.checkRequested.next();
        this.offerAtSafeLocation();
      });
  }

  private offerAtSafeLocation(): void {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    if (
      route.data['updatePromptAllowed'] === true &&
      this.pendingBuildId() !== this.deferredBuildId()
    ) {
      this.requestReload();
    }
  }

  requestReload(): void {
    const buildId = this.pendingBuildId();
    if (!buildId || this.reloading || this.dialog.openDialogs.length > 0) return;
    this.dialog
      .open(AppUpdateDialogComponent, { autoFocus: 'first-tabbable' })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed: unknown) => {
        if (confirmed === true) {
          // If a proxy still serves the old index, do not automatically prompt again.
          try {
            sessionStorage.setItem(this.storageKey, buildId);
          } catch {
            // Reloading remains possible when storage is disabled.
          }
          this.store.dispatch(AppUpdateActions.reloadConfirmed());
          this.reloading = true;
          this.reload();
          return;
        }
        this.store.dispatch(AppUpdateActions.reloadDeferred({ buildId }));
        try {
          sessionStorage.setItem(this.storageKey, buildId);
        } catch {
          /* The in-memory decision still applies. */
        }
      });
  }
}

export const isBuildInfo = (value: unknown): value is { appVersion: string; buildId: string } => {
  if (typeof value !== 'object' || value === null) return false;
  const info = value as Record<string, unknown>;
  return (
    typeof info['appVersion'] === 'string' &&
    info['appVersion'].length > 0 &&
    typeof info['buildId'] === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(info['buildId'])
  );
};
