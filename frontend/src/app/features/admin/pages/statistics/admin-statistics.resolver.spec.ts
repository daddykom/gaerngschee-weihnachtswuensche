import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminStatisticsActions } from '../../../../store/admin-statistics/admin-statistics.actions';
import { AdminStatisticsRequest } from '../../../../store/admin-statistics/admin-statistics.state';
import { adminStatisticsResolver } from './admin-statistics.resolver';

describe('adminStatisticsResolver', () => {
  for (const status of ['loaded', 'error', 'cancelled'] as const) {
    it(`stops progress after ${status} and waits for a terminal state`, () => {
      const state = new Subject<AdminStatisticsRequest>();
      const dispatch = vi.fn();
      const progress = { start: vi.fn(), stop: vi.fn() };
      TestBed.configureTestingModule({
        providers: [
          { provide: Store, useValue: { dispatch, select: () => state } },
          { provide: NavigationProgressService, useValue: progress },
        ],
      });
      const result = TestBed.runInInjectionContext(() =>
        adminStatisticsResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ) as Observable<boolean>;
      const next = vi.fn();
      const subscription = result.subscribe(next);
      expect(dispatch).toHaveBeenCalledWith(AdminStatisticsActions.pageEntered());
      expect(progress.start).toHaveBeenCalledOnce();
      state.next({ status: 'loading' });
      expect(next).not.toHaveBeenCalled();
      expect(progress.stop).not.toHaveBeenCalled();
      if (status === 'error') state.next({ status: 'error', errorCode: 'FAILED' });
      if (status === 'loaded')
        state.next({
          status: 'loaded',
          statistics: {
            year: 2026,
            orderCount: 0,
            wishCount: 0,
            availableCount: 0,
            pendingConfirmationCount: 0,
            reservedCount: 0,
            receivedCount: 0,
            completedCount: 0,
          },
        });
      subscription.unsubscribe();
      expect(progress.stop).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledTimes(status === 'cancelled' ? 0 : 1);
    });
  }
});
