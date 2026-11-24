import { inject, InjectionToken } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Actions, createEffect, ofType, ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { EMPTY, exhaustMap, map, take, tap, withLatestFrom } from 'rxjs';
import { BUILD_INFO } from '../../../generated/build-info';
import { AppUpdateDialogComponent } from '../../shared/components/app-update-dialog/app-update-dialog.component';
import { AppUpdateActions, appUpdateFeature } from './app-update.feature';

export const RELOAD_APPLICATION = new InjectionToken<() => void>('Reload application', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});

const storageKey = `gaerngschee.update-deferred:${BUILD_INFO.buildId}`;

const rememberBuild = (buildId: string): void => {
  try {
    sessionStorage.setItem(storageKey, buildId);
  } catch {
    // The in-memory decision and reload remain available when storage is disabled.
  }
};

export const restoreUpdateDeferralEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => {
        let buildId: string | null = null;
        try {
          buildId = sessionStorage.getItem(storageKey);
        } catch {
          // Disabled storage must not prevent update detection.
        }
        return AppUpdateActions.deferralRestored({ buildId });
      }),
    ),
  { functional: true },
);

export const offerAppUpdateEffect = createEffect(
  (actions$ = inject(Actions), store = inject(Store), dialog = inject(MatDialog)) =>
    actions$.pipe(
      ofType(
        AppUpdateActions.buildDetected,
        AppUpdateActions.reloadClicked,
        AppUpdateActions.deferralRestored,
      ),
      withLatestFrom(store.select(appUpdateFeature.selectAppUpdateState)),
      exhaustMap(([action, state]) => {
        const buildId = state.pendingBuildId;
        if (
          !buildId ||
          state.reloading ||
          dialog.openDialogs.length > 0 ||
          (action.type !== AppUpdateActions.reloadClicked.type && buildId === state.deferredBuildId)
        ) {
          return EMPTY;
        }
        return dialog
          .open(AppUpdateDialogComponent, { autoFocus: 'first-tabbable' })
          .afterClosed()
          .pipe(
            take(1),
            map((confirmed: unknown) =>
              confirmed === true
                ? AppUpdateActions.reloadConfirmed({ buildId })
                : AppUpdateActions.reloadDeferred({ buildId }),
            ),
          );
      }),
    ),
  { functional: true },
);

export const rememberUpdateDeferralEffect = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AppUpdateActions.reloadDeferred),
      tap(({ buildId }) => rememberBuild(buildId)),
    ),
  { functional: true, dispatch: false },
);

export const reloadApplicationEffect = createEffect(
  (actions$ = inject(Actions), reload = inject(RELOAD_APPLICATION)) =>
    actions$.pipe(
      ofType(AppUpdateActions.reloadConfirmed),
      take(1),
      tap(({ buildId }) => {
        // Remember before reloading so an old index cannot cause a prompt loop.
        rememberBuild(buildId);
        reload();
      }),
    ),
  { functional: true, dispatch: false },
);

export const appUpdateEffects = {
  restoreUpdateDeferralEffect,
  offerAppUpdateEffect,
  rememberUpdateDeferralEffect,
  reloadApplicationEffect,
};
