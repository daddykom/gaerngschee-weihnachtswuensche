import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { firstValueFrom, of, Subject, take, throwError, toArray } from 'rxjs';
import { type Mock } from 'vitest';
import { FrontendConfigService } from '../../shared/services/frontend-config.service';
import { NotificationActions } from '../notification/notification.actions';
import { FrontendConfigActions } from './frontend-config.actions';
import {
  frontendConfigNotificationEffect,
  loadFrontendConfigEffect,
  loadPublicFrontendConfigEffect,
  saveFrontendConfigEffect,
} from './frontend-config.effects';

describe('frontend config effects', () => {
  let actions$: Subject<Action>;
  let service: { list: Mock; listPublic: Mock; update: Mock };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    service = { list: vi.fn(), listPublic: vi.fn(), update: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        { provide: FrontendConfigService, useValue: service },
      ],
    });
  });

  it('loads and saves configuration values', async () => {
    const configs = [{ id: 'site_name' } as never];
    service.list.mockReturnValue(of(configs));
    const load = firstValueFrom(TestBed.runInInjectionContext(() => loadFrontendConfigEffect()));
    actions$.next(FrontendConfigActions.load());
    await expect(load).resolves.toEqual(FrontendConfigActions.loadSuccess({ configs }));

    service.update.mockImplementation((id: string, value: string | string[]) =>
      of({ id, value } as never),
    );
    const save = firstValueFrom(
      TestBed.runInInjectionContext(() => saveFrontendConfigEffect().pipe(take(2), toArray())),
    );
    actions$.next(
      FrontendConfigActions.save({
        configs: [
          { id: 'site_name', value: 'Gaerngschee' },
          { id: 'languages', value: ['de', 'fr'] },
        ],
      }),
    );
    await expect(save).resolves.toEqual([
      FrontendConfigActions.saveSuccess({
        configs: [
          { id: 'site_name', value: 'Gaerngschee' },
          { id: 'languages', value: ['de', 'fr'] },
        ] as never,
      }),
      FrontendConfigActions.loadPublic(),
    ]);
    expect(service.update).toHaveBeenNthCalledWith(1, 'site_name', 'Gaerngschee');
    expect(service.update).toHaveBeenNthCalledWith(2, 'languages', ['de', 'fr']);
  });

  it('loads public configuration values', async () => {
    const configs = [{ variableName: 'fairgate_url', value: 'https://fairgate.example' }];
    service.listPublic.mockReturnValue(of(configs));
    const load = firstValueFrom(
      TestBed.runInInjectionContext(() => loadPublicFrontendConfigEffect()),
    );

    actions$.next(FrontendConfigActions.loadPublic());

    await expect(load).resolves.toEqual(FrontendConfigActions.loadPublicSuccess({ configs }));
  });

  it('maps backend errors and emits notifications', async () => {
    service.list.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { error: { code: 'DENIED' } } })),
    );
    const failure = firstValueFrom(TestBed.runInInjectionContext(() => loadFrontendConfigEffect()));
    actions$.next(FrontendConfigActions.load());
    await expect(failure).resolves.toEqual(
      FrontendConfigActions.loadFailure({ errorCode: 'DENIED' }),
    );

    const notification = firstValueFrom(
      TestBed.runInInjectionContext(() => frontendConfigNotificationEffect()),
    );
    actions$.next(FrontendConfigActions.saveFailure({ errorCode: 'INVALID' }));
    await expect(notification).resolves.toEqual(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.admin.configuration.errorTitle',
        messageKey: 'app.admin.configuration.errors.INVALID',
        preserveOnRoutes: ['/admin/configuration'],
      }),
    );
  });

  it('emits a global notification when public configuration loading fails', async () => {
    const notification = firstValueFrom(
      TestBed.runInInjectionContext(() => frontendConfigNotificationEffect()),
    );
    actions$.next(FrontendConfigActions.loadPublicFailure({ errorCode: 'REQUEST_FAILED' }));

    await expect(notification).resolves.toEqual(
      NotificationActions.show({
        variant: 'error',
        titleKey: 'app.publicConfiguration.errorTitle',
        messageKey: 'app.publicConfiguration.error',
      }),
    );
  });
});
