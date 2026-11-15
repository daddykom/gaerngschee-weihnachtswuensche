import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import {
  OrderFormValue,
  OrderOverviewResponse,
  OrderStatus,
  SaveOrderResponse,
} from '../../shared/models/order.model';
import { OrderService } from '../../shared/services/order.service';
import { AuthActions } from '../auth/auth.actions';
import { OrderActions } from './order.actions';
import {
  logoutAfterOrderSaveEffect,
  orderFairgateNotificationEffect,
  orderSaveSuccessNotificationEffect,
  saveOrderEffect,
} from './order.effects';
import { orderFeature, selectOrderState } from './order.feature';
import { initialState } from './order.state';

describe('order save effects', () => {
  let actions$: Subject<Action>;
  const form: OrderFormValue = {
    password: '',
    passwordConfirmation: '',
    adultsCount: 1,
    childrenCount: 0,
    text: '',
    items: [],
  };
  const result = (status: 'draft' | 'released'): SaveOrderResponse => ({
    order: { id: 'order-1', status } as SaveOrderResponse['order'],
    status,
    fairgateUserExists: true,
  });

  beforeEach(() => {
    actions$ = new Subject<Action>();
    TestBed.configureTestingModule({ providers: [provideMockActions(() => actions$)] });
  });

  it.each(['draft', 'submit'] as const)('sends the %s save mode', async (mode) => {
    const response = result(mode === 'draft' ? 'draft' : 'released');
    const service = { save: vi.fn(() => of(response)) };
    const effect = firstValueFrom(saveOrderEffect(actions$, service as unknown as OrderService));
    actions$.next(
      mode === 'draft' ? OrderActions.draftSaveClicked({ form }) : OrderActions.save({ form }),
    );
    await expect(effect).resolves.toEqual(OrderActions.saveSuccess({ result: response }));
    expect(service.save).toHaveBeenCalledWith(form, mode);
  });

  it('does not log out after saving a draft', () => {
    const logout = vi.fn();
    const subscription = TestBed.runInInjectionContext(() =>
      logoutAfterOrderSaveEffect(),
    ).subscribe(logout);
    actions$.next(OrderActions.saveSuccess({ result: result('draft') }));
    expect(logout).not.toHaveBeenCalled();
    actions$.next(OrderActions.saveSuccess({ result: result('released') }));
    expect(logout).toHaveBeenCalledWith(
      AuthActions.logoutRequestedWithRedirect({
        target: '/bestellung/bestaetigung?status=released',
      }),
    );
    subscription.unsubscribe();
  });

  it('announces a draft save on the editable order route', async () => {
    const notification = firstValueFrom(
      TestBed.runInInjectionContext(() => orderSaveSuccessNotificationEffect()),
    );
    actions$.next(OrderActions.saveSuccess({ result: result('draft') }));
    await expect(notification).resolves.toMatchObject({
      messageKey: 'app.order.notifications.draftSaved',
      preserveOnRoutes: ['/bestellung'],
    });
  });

  it('announces submission as released', async () => {
    const notification = firstValueFrom(
      TestBed.runInInjectionContext(() => orderSaveSuccessNotificationEffect()),
    );
    actions$.next(OrderActions.saveSuccess({ result: result('released') }));
    await expect(notification).resolves.toMatchObject({
      variant: 'success',
      titleKey: 'app.order.confirmation.releasedTitle',
      messageKey: 'app.order.confirmation.releasedMessage',
      preserveOnRoutes: ['/bestellung/bestaetigung'],
    });
  });
});

describe('order status notifications', () => {
  let actions$: Subject<Action>;

  const enterPage = (data: OrderOverviewResponse): void => {
    TestBed.inject(MockStore).setState({
      order: orderFeature.reducer(initialState, OrderActions.loadSuccess({ overview: data })),
    });
    actions$.next(OrderActions.pageEntered());
  };

  const overview = (
    status: OrderStatus | null,
    adminNotes: string | null = null,
  ): OrderOverviewResponse => ({
    order:
      status === null
        ? null
        : {
            id: 'order-1',
            userId: 'user-1',
            year: 2026,
            status,
            adultsCount: 1,
            childrenCount: 0,
            originalText: 'Original family text',
            currentText: 'Edited family text',
            adminNotes,
            items: [],
            fairgateStatus: 'valid',
            confirmationEmailSentAt: null,
            fairgateReminderEmailSentAt: null,
            createdAt: null,
            updatedAt: null,
          },
    year: 2026,
    fairgateStatus: 'valid',
    fairgateUserExists: true,
    adultsCount: 1,
    childrenCount: 0,
    canEdit: status === null || status === 'draft' || status === 'changes_requested',
  });

  beforeEach(() => {
    actions$ = new Subject<Action>();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({ initialState: { order: initialState } }),
      ],
    });
  });

  it.each(['changes_requested', 'draft'] as const)(
    'prioritizes the order feedback over the Fairgate notice for %s',
    async (status) => {
      const feedback = 'Please review <b>this text</b>.\nPlease check the second paragraph.';
      const notification = firstValueFrom(
        TestBed.runInInjectionContext(() => orderFairgateNotificationEffect()),
      );
      enterPage(overview(status, feedback));

      await expect(notification).resolves.toEqual({
        type: '[Notification] Show',
        variant: 'warning',
        titleKey: 'app.order.status.changes_requested.title',
        messageKey: 'app.order.status.changes_requested.messageWithFeedback',
        params: { feedback },
        preserveOnRoutes: ['/bestellung'],
      });
    },
  );

  it.each([null, '', '   '])(
    'shows a general review notice for a returned order without feedback: %j',
    async (feedback) => {
      const notification = firstValueFrom(
        TestBed.runInInjectionContext(() => orderFairgateNotificationEffect()),
      );
      enterPage(overview('changes_requested', feedback));

      await expect(notification).resolves.toMatchObject({
        variant: 'warning',
        messageKey: 'app.order.status.changes_requested.message',
      });
    },
  );

  it.each(['released', 'in_review', 'definitive', 'ready_for_pickup', 'completed'] as const)(
    'does not display old order feedback for %s',
    async (status) => {
      const notification = firstValueFrom(
        TestBed.runInInjectionContext(() => orderFairgateNotificationEffect()),
      );
      enterPage(overview(status, 'Previous feedback'));

      await expect(notification).resolves.toEqual({
        type: '[Notification] Show',
        variant: 'info',
        titleKey: `app.order.status.${status}.title`,
        messageKey: `app.order.status.${status}.message`,
        preserveOnRoutes: ['/bestellung'],
      });
    },
  );

  it.each([null, 'draft'] as const)(
    'keeps the Fairgate notice for an order without review feedback: %j',
    async (status) => {
      const notification = firstValueFrom(
        TestBed.runInInjectionContext(() => orderFairgateNotificationEffect()),
      );
      enterPage(overview(status));

      await expect(notification).resolves.toMatchObject({
        variant: 'info',
        messageKey: 'app.order.fairgate.validMessage',
      });
    },
  );

  it.each(['initial', 'loading', 'error'] as const)(
    'does not overwrite notifications while order data is %s',
    (status) => {
      TestBed.inject(MockStore).setState({ order: { ...initialState, status } });
      const notification = vi.fn();
      const subscription = TestBed.runInInjectionContext(() =>
        orderFairgateNotificationEffect(),
      ).subscribe(notification);
      actions$.next(OrderActions.pageEntered());

      expect(notification).not.toHaveBeenCalled();
      subscription.unsubscribe();
    },
  );

  it('restores the feedback when the page is entered again without resetting unsaved form values', () => {
    const store = TestBed.inject(MockStore);
    const notification = vi.fn();
    const subscription = TestBed.runInInjectionContext(() =>
      orderFairgateNotificationEffect(),
    ).subscribe(notification);
    enterPage(overview('changes_requested', 'Please review the family text'));
    const state = store.selectSignal(selectOrderState)();
    const changed = orderFeature.reducer(
      state,
      OrderActions.formChanged({ changes: { text: 'Unsaved requester text' } }),
    );
    store.setState({ order: changed });
    actions$.next(OrderActions.pageEntered());

    expect(notification).toHaveBeenCalledTimes(2);
    expect(notification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messageKey: 'app.order.status.changes_requested.messageWithFeedback',
        params: { feedback: 'Please review the family text' },
      }),
    );
    expect(store.selectSignal(selectOrderState)().form.text).toBe('Unsaved requester text');
    subscription.unsubscribe();
  });
});
