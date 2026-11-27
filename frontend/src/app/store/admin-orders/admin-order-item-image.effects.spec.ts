import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { OrderItemImagesService } from '../../shared/services/order-item-images.service';
import { ImageTransfersActions } from '../image-transfers/image-transfers.actions';
import { selectImageTransfers } from '../image-transfers/image-transfers.feature';
import { NotificationActions } from '../notification/notification.actions';
import { AdminOrdersActions } from './admin-orders.actions';
import {
  adminItemImageErrorEffect,
  loadAdminItemImageEffect,
  refreshAdminItemImageEffect,
} from './admin-orders.effects';
import { selectAdminItemImage } from './admin-orders.feature';

describe('admin wish image loading', () => {
  const identity = { orderId: 'order-1', itemId: 'item-1' };
  let actions$: Subject<Action>;
  const service = { metadata: vi.fn(), image: vi.fn() };

  beforeEach(() => {
    service.metadata.mockReset();
    service.image.mockReset();
    actions$ = new Subject<Action>();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore(),
        { provide: OrderItemImagesService, useValue: service },
      ],
    });
  });

  it('does not request binary content when there is no stored image', async () => {
    const data = { revision: 0, image: null };
    service.metadata.mockReturnValue(of(data));
    const result = firstValueFrom(TestBed.runInInjectionContext(() => loadAdminItemImageEffect()));
    actions$.next(AdminOrdersActions.imageEditorEntered(identity));
    await expect(result).resolves.toEqual(
      AdminOrdersActions.imageLoaded({ ...identity, data, blob: null }),
    );
    expect(service.image).not.toHaveBeenCalled();
  });

  it('loads metadata and the protected binary image separately', async () => {
    const data = { revision: 1, image: { id: 'image-1' } };
    const blob = new Blob(['image'], { type: 'image/png' });
    service.metadata.mockReturnValue(of(data));
    service.image.mockReturnValue(of(blob));
    const result = firstValueFrom(TestBed.runInInjectionContext(() => loadAdminItemImageEffect()));
    actions$.next(AdminOrdersActions.imageReloadClicked(identity));
    await expect(result).resolves.toEqual(
      AdminOrdersActions.imageLoaded({ ...identity, data, blob } as never),
    );
    expect(service.image).toHaveBeenCalledWith(identity.orderId, identity.itemId);
  });

  it('refreshes only the image context matching a completed transfer', async () => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectImageTransfers, [
      { ...identity, id: 'matching', status: 'success', result: { revision: 1, image: null } },
      {
        ...identity,
        itemId: 'other',
        id: 'unrelated',
        status: 'success',
        result: { revision: 1, image: null },
      },
    ]);
    store.overrideSelector(selectAdminItemImage, {
      ...identity,
      status: 'loaded',
      data: { revision: 0, image: null },
      blob: null,
    });
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() => refreshAdminItemImageEffect()),
    );
    actions$.next(
      ImageTransfersActions.transferSucceeded({
        id: 'unrelated',
        result: { revision: 1, image: null },
      }),
    );
    actions$.next(
      ImageTransfersActions.transferSucceeded({
        id: 'matching',
        result: { revision: 1, image: null },
      }),
    );
    await expect(result).resolves.toEqual(AdminOrdersActions.imageReloadClicked(identity));
  });

  it('returns a terminal error for metadata or binary failures and reports it centrally', async () => {
    for (const binaryFailure of [false, true]) {
      const failure = throwError(() => new HttpErrorResponse({ status: 500 }));
      service.metadata.mockReturnValue(
        binaryFailure ? of({ revision: 1, image: { id: 'image-1' } }) : failure,
      );
      service.image.mockReturnValue(failure);
      const result = firstValueFrom(
        TestBed.runInInjectionContext(() => loadAdminItemImageEffect()),
      );
      actions$.next(AdminOrdersActions.imageEditorEntered(identity));
      await expect(result).resolves.toEqual(
        AdminOrdersActions.imageLoadFailed({ ...identity, errorCode: 'REQUEST_FAILED' }),
      );
    }
    const notification = firstValueFrom(
      TestBed.runInInjectionContext(() => adminItemImageErrorEffect()),
    );
    actions$.next(AdminOrdersActions.imageLoadFailed({ ...identity, errorCode: 'REQUEST_FAILED' }));
    await expect(notification).resolves.toEqual(
      expect.objectContaining({
        type: NotificationActions.show.type,
        messageKey: 'app.admin.itemImage.loadError',
        preserveOnRoutes: ['/admin/orders/order-1/edit/item/item-1'],
      }),
    );
  });
});
