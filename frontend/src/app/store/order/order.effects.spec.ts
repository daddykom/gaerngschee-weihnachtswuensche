import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { firstValueFrom, of, Subject } from 'rxjs';
import { OrderFormValue, SaveOrderResponse } from '../../shared/models/order.model';
import { OrderService } from '../../shared/services/order.service';
import { AuthActions } from '../auth/auth.actions';
import { OrderActions } from './order.actions';
import {
  logoutAfterOrderSaveEffect,
  orderSaveSuccessNotificationEffect,
  saveOrderEffect,
} from './order.effects';

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
