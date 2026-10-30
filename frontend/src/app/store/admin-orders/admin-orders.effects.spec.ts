import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { type Mock } from 'vitest';
import { AdminOrdersService } from '../../shared/services/admin-orders.service';
import { NavigationActions } from '../navigation/navigation.actions';
import { AdminOrdersActions } from './admin-orders.actions';
import {
  loadAdminOrdersEffect,
  navigateBackAfterAdminOrderSaveEffect,
  saveAdminOrderEffect,
} from './admin-orders.effects';

describe('admin orders effects', () => {
  let actions$: Subject<Action>;
  let service: { list: Mock; update: Mock };
  let store: MockStore;

  beforeEach(() => {
    actions$ = new Subject<Action>();
    service = { list: vi.fn(), update: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({ initialState: {
          adminOrders: {
            orders: [],
            statuses: ['released'],
            categories: ['gift'],
            loadStatus: 'loaded',
            saveStatus: 'initial',
            errorCode: null,
          },
        } }),
        { provide: AdminOrdersService, useValue: service },
      ],
    });
    store = TestBed.inject(MockStore);
  });

  it('loads filtered orders and maps backend failures', async () => {
    service.list.mockReturnValueOnce(of({ orders: [{ id: 'order-1' }], statuses: [], categories: [] }));
    const success = firstValueFrom(TestBed.runInInjectionContext(() => loadAdminOrdersEffect()));
    actions$.next(AdminOrdersActions.load());
    await expect(success).resolves.toEqual(AdminOrdersActions.loadSuccess({ orders: [{ id: 'order-1' }] as never }));
    expect(service.list).toHaveBeenCalledWith(['released'], ['gift']);

    service.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ error: { error: { code: 'DENIED' } } })));
    const failure = firstValueFrom(TestBed.runInInjectionContext(() => loadAdminOrdersEffect()));
    store.setState({ adminOrders: {
      orders: [],
      statuses: [],
      categories: [],
      loadStatus: 'loading',
      saveStatus: 'initial',
      errorCode: null,
    } });
    actions$.next(AdminOrdersActions.filtersChanged({ statuses: [], categories: [] }));
    await expect(failure).resolves.toEqual(AdminOrdersActions.loadFailure({ errorCode: 'DENIED' }));
  });

  it('updates the complete order with the selected action and maps failures', async () => {
    const order = { id: 'order-1' } as never;
    service.update.mockReturnValueOnce(of({ order }));
    const success = firstValueFrom(TestBed.runInInjectionContext(() => saveAdminOrderEffect()));
    actions$.next(AdminOrdersActions.save({ order, action: 'release' }));
    await expect(success).resolves.toEqual(AdminOrdersActions.saveSuccess({ order }));
    expect(service.update).toHaveBeenCalledWith(order, 'release');

    service.update.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ error: { error: { code: 'ORDER_UPDATE_FAILED' } } })));
    const failure = firstValueFrom(TestBed.runInInjectionContext(() => saveAdminOrderEffect()));
    actions$.next(AdminOrdersActions.save({ order, action: 'save' }));
    await expect(failure).resolves.toEqual(AdminOrdersActions.saveFailure({ errorCode: 'ORDER_UPDATE_FAILED' }));
  });

  it('navigates back only after a successful order save', async () => {
    const result = firstValueFrom(TestBed.runInInjectionContext(() => navigateBackAfterAdminOrderSaveEffect()));
    actions$.next(AdminOrdersActions.saveSuccess({ order: { id: 'order-1' } as never }));
    await expect(result).resolves.toEqual(NavigationActions.navigate({ target: 'back' }));
  });
});
