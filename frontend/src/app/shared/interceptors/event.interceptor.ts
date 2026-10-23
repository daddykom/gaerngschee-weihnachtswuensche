import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, tap, throwError } from 'rxjs';
import { EventActions } from '../../store/events/events.actions';
import { selectEventValues } from '../../store/events/events.feature';

const EVENT_HEADER_PREFIX = 'x-event-';

const publishEvents = (headers: HttpResponse<unknown>['headers'], store: Store): void => {
  const values = store.selectSignal(selectEventValues)();
  for (const header of headers.keys()) {
    const normalizedHeader = header.toLowerCase();
    if (!normalizedHeader.startsWith(EVENT_HEADER_PREFIX)) {
      continue;
    }

    const key = normalizedHeader.slice(EVENT_HEADER_PREFIX.length);
    const value = Number(headers.get(header));
    if (key === '' || !Number.isInteger(value) || value <= (values[key] ?? 0)) {
      continue;
    }

    store.dispatch(EventActions.received({ key, value }));
  }
};

export const eventInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(Store);

  return next(request).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse) {
        publishEvents(event.headers, store);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      publishEvents(error.headers, store);
      return throwError(() => error);
    }),
  );
};
