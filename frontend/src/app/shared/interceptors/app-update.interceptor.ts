import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { tap } from 'rxjs';
import { BUILD_INFO } from '../../../generated/build-info';
import { AppUpdateActions } from '../../store/app-update/app-update.feature';

export const appUpdateInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);
  const publishBuild = (headers: HttpHeaders): void => {
    const buildId = headers.get('X-App-Build');
    if (buildId && /^[a-zA-Z0-9_-]{1,100}$/.test(buildId) && buildId !== BUILD_INFO.buildId) {
      store.dispatch(AppUpdateActions.buildDetected({ buildId }));
    }
  };

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) publishBuild(event.headers);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) publishBuild(error.headers);
      },
    }),
  );
};
