import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, finalize, map, take } from 'rxjs';
import { NavigationProgressService } from '../../../../shared/services/navigation-progress.service';
import { EmailTestActions } from '../../../../store/email-test/email-test.actions';
import { selectEmailTestStatus } from '../../../../store/email-test/email-test.feature';

export const emailTestResolver: ResolveFn<boolean> = () => {
  const store = inject(Store);
  const progress = inject(NavigationProgressService);
  progress.start();
  store.dispatch(EmailTestActions.load());
  return store.select(selectEmailTestStatus).pipe(
    filter((status) => status !== 'loading' && status !== 'initial'),
    take(1),
    map(() => true),
    finalize(() => progress.stop()),
  );
};
