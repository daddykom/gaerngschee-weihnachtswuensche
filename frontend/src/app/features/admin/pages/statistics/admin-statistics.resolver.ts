import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { AdminStatisticsActions } from '../../../../store/admin-statistics/admin-statistics.actions';
import { selectAdminStatisticsRequest } from '../../../../store/admin-statistics/admin-statistics.feature';

export const adminStatisticsResolver: ResolveFn<boolean> = () => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);
  progress.start();
  store.dispatch(AdminStatisticsActions.pageEntered());
  return store.select(selectAdminStatisticsRequest).pipe(
    filter((request) => request.status === 'loaded' || request.status === 'error'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
