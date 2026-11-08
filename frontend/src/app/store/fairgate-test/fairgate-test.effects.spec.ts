import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { type Mock } from 'vitest';
import { FairgateTestService } from '../../shared/services/fairgate-test.service';
import { FairgateTestActions } from './fairgate-test.actions';
import { fairgateTestEffect } from './fairgate-test.effects';

describe('fairgateTestEffect', () => {
  let actions$: Subject<Action>;
  let service: { test: Mock };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    service = { test: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        { provide: FairgateTestService, useValue: service },
      ],
    });
  });

  it('maps a successful test response to a success action', async () => {
    const result = { email: 'person@example.com', fairgate: { success: true } };
    service.test.mockReturnValue(of(result));
    const effect = firstValueFrom(TestBed.runInInjectionContext(() => fairgateTestEffect()));
    actions$.next(FairgateTestActions.test());
    await expect(effect).resolves.toEqual(FairgateTestActions.testSuccess({ result }));
    expect(service.test).toHaveBeenCalledTimes(1);
  });

  it('maps structured and unstructured errors to failure actions', async () => {
    service.test.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { error: { code: 'FAIRGATE_FAILED' } } })),
    );
    const effect = firstValueFrom(TestBed.runInInjectionContext(() => fairgateTestEffect()));
    actions$.next(FairgateTestActions.test());
    await expect(effect).resolves.toEqual(
      FairgateTestActions.testFailure({ errorCode: 'FAIRGATE_FAILED' }),
    );

    service.test.mockReturnValue(throwError(() => new Error('network')));
    const fallback = firstValueFrom(TestBed.runInInjectionContext(() => fairgateTestEffect()));
    actions$.next(FairgateTestActions.test());
    await expect(fallback).resolves.toEqual(
      FairgateTestActions.testFailure({ errorCode: 'REQUEST_FAILED' }),
    );
  });
});
