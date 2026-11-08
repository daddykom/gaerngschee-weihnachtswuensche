import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { firstValueFrom, of, Subject, take, throwError, toArray } from 'rxjs';
import { AnmeldungService } from '../../shared/services/anmeldung.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { NotificationActions } from '../notification/notification.actions';
import { StartActions } from './start.actions';
import {
  showStartFailureNotificationEffect,
  showStartSuccessAndNavigateEffect,
  submitStartEffect,
} from './start.effects';

describe('submitStartEffect', () => {
  let actions$: Subject<Action>;
  let anmeldungService: { requestInformation: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    anmeldungService = { requestInformation: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        { provide: AnmeldungService, useValue: anmeldungService },
      ],
    });
  });

  it('maps a successful service response to a success action', async () => {
    anmeldungService.requestInformation.mockReturnValue(of({ sent: true }));
    const effect$ = TestBed.runInInjectionContext(() => submitStartEffect());
    const result = firstValueFrom(effect$);

    actions$.next(StartActions.submit({ email: 'person@example.com', language: 'de' }));

    await expect(result).resolves.toEqual(StartActions.submitSuccess({ sent: true }));
    expect(anmeldungService.requestInformation).toHaveBeenCalledWith('person@example.com', 'de');
  });

  it('maps a service error to a failure action', async () => {
    anmeldungService.requestInformation.mockReturnValue(throwError(() => new Error('SMTP failed')));
    const effect$ = TestBed.runInInjectionContext(() => submitStartEffect());
    const result = firstValueFrom(effect$);

    actions$.next(StartActions.submit({ email: 'person@example.com', language: 'de' }));

    await expect(result).resolves.toEqual(StartActions.submitFailure());
  });

  it('shows the success notification and navigates to the success page', async () => {
    const effect$ = TestBed.runInInjectionContext(() => showStartSuccessAndNavigateEffect());
    const result = firstValueFrom(effect$.pipe(take(2), toArray()));

    actions$.next(StartActions.submitSuccess({ sent: true }));

    await expect(result).resolves.toEqual([
      NotificationActions.show({
        variant: 'success',
        titleKey: 'app.anmeldung.emailSentTitle',
        messageKey: 'app.anmeldung.emailSentMessage',
        preserveOnRoutes: ['/start/success'],
      }),
      NavigationActions.navigate({ target: '/start/success' }),
    ]);
  });

  it('shows an error notification when sending fails', async () => {
    const effect$ = TestBed.runInInjectionContext(() => showStartFailureNotificationEffect());
    const result = firstValueFrom(effect$);

    actions$.next(StartActions.submitFailure());

    await expect(result).resolves.toEqual({
      type: '[Notification] Show',
      variant: 'error',
      titleKey: 'app.anmeldung.errorTitle',
      messageKey: 'app.anmeldung.sendError',
      preserveOnRoutes: ['/start'],
    });
  });
});
