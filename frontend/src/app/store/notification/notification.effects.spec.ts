import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { NotificationActions } from './notification.actions';
import { notificationRouteEffect } from './notification.effects';

describe('notificationRouteEffect', () => {
  let routerEvents$: Subject<unknown>;

  beforeEach(() => {
    routerEvents$ = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events: routerEvents$ } }],
    });
  });

  it('emits a navigation completed action for NavigationEnd', async () => {
    const result = firstValueFrom(TestBed.runInInjectionContext(() => notificationRouteEffect()));

    routerEvents$.next(new NavigationEnd(1, '/login', '/admin/overview?from=login'));

    await expect(result).resolves.toEqual(
      NotificationActions.navigationCompleted({ url: '/admin/overview?from=login' }),
    );
  });

  it('ignores router events that are not NavigationEnd', () => {
    const effect$ = TestBed.runInInjectionContext(() => notificationRouteEffect());
    const next = vi.fn();
    const subscription = effect$.subscribe(next);

    routerEvents$.next(new NavigationStart(1, '/login'));

    expect(next).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
});
