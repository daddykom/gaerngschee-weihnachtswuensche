import { inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { createEffect } from '@ngrx/effects';
import { filter, map } from 'rxjs';
import { NotificationActions } from './notification.actions';

export const notificationRouteEffect = createEffect(
  (router = inject(Router)) =>
    router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(({ urlAfterRedirects }) =>
        NotificationActions.navigationCompleted({ url: urlAfterRedirects }),
      ),
    ),
  { functional: true },
);

export const notificationEffects = { notificationRouteEffect };
