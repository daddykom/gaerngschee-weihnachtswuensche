import { HttpEventType, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Actions, provideEffects } from '@ngrx/effects';
import { provideStore, Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { AdminOrder } from '../../shared/models/admin-order.model';
import { AdminOrdersActions } from '../admin-orders/admin-orders.actions';
import { adminOrdersEffects } from '../admin-orders/admin-orders.effects';
import { adminOrdersFeature } from '../admin-orders/admin-orders.feature';
import { AuthActions } from '../auth/auth.actions';
import { SessionActions } from '../auth/session.actions';
import { NavigationActions } from '../navigation/navigation.actions';
import { ImageTransfersActions as actions } from './image-transfers.actions';
import { imageTransfersEffects } from './image-transfers.effects';
import { imageTransfersFeature, selectImageTransfers } from './image-transfers.feature';
import { QueuedImageTransfer } from './image-transfers.state';

describe('background image transfer workflow', () => {
  let http: HttpTestingController;
  let store: Store;
  let actionSubscription: Subscription;
  const file = new File(['gift'], 'gift.png', { type: 'image/png' });
  const order = { id: 'order-1', items: [{ id: 'item-1' }] } as AdminOrder;
  const imageUrl = 'http://localhost:8083/admin/orders/order-1/items/item-1/image';
  const job = (id = 'transfer-1', itemId = 'item-1'): QueuedImageTransfer => ({
    id,
    orderId: order.id,
    itemId,
    status: 'queued',
    change: { operation: 'replace', revision: 0, file },
  });
  const jobs = () => store.selectSignal(selectImageTransfers)();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideStore({
          adminOrders: adminOrdersFeature.reducer,
          imageTransfers: imageTransfersFeature.reducer,
        }),
        provideEffects(imageTransfersEffects, adminOrdersEffects),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
  });

  afterEach(() => {
    actionSubscription?.unsubscribe();
    http.verify({ ignoreCancelled: true });
  });

  it('saves wish data first, navigates without waiting and continues the upload through route and list changes', () => {
    const navigation: string[] = [];
    actionSubscription = TestBed.inject(Actions).subscribe((action) => {
      if (action.type === NavigationActions.navigate.type) navigation.push('back');
    });
    store.dispatch(
      AdminOrdersActions.save({
        order,
        imageChanges: [{ itemId: 'item-1', change: { operation: 'replace', revision: 0, file } }],
      }),
    );
    const save = http.expectOne('http://localhost:8083/admin/orders/order-1');
    http.expectNone(imageUrl);
    expect(JSON.stringify(save.request.body)).not.toContain('gift.png');
    save.flush({ order, mailSent: false });
    const upload = http.expectOne(imageUrl);
    expect(navigation).toEqual(['back']);
    expect(jobs()[0]).toMatchObject({ status: 'uploading', percent: 0 });

    store.dispatch(NavigationActions.navigate({ target: '/' }));
    store.dispatch(AdminOrdersActions.loadSuccess({ orders: [] }));
    expect(upload.cancelled).toBe(false);
    upload.event({ type: HttpEventType.UploadProgress, loaded: 22, total: 100 });
    expect(jobs()[0]).toMatchObject({ status: 'uploading', percent: 22 });
    upload.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    expect(jobs()[0]).toMatchObject({ status: 'uploading', percent: 100 });
    upload.flush({ revision: 1, image: null });
    expect(jobs()[0]).toMatchObject({ status: 'success', result: { revision: 1 } });
  });

  it('does not queue images or navigate when the wish-data save fails', () => {
    store.dispatch(
      AdminOrdersActions.save({
        order,
        imageChanges: [{ itemId: 'item-1', change: { operation: 'replace', revision: 0, file } }],
      }),
    );
    http
      .expectOne('http://localhost:8083/admin/orders/order-1')
      .flush({ error: { code: 'ORDER_UPDATE_FAILED' } }, { status: 500, statusText: 'Failed' });
    http.expectNone(imageUrl);
    expect(jobs()).toEqual([]);
  });

  it('retains saved wish data on image failure and retries only the image request', () => {
    store.dispatch(
      AdminOrdersActions.save({
        order,
        imageChanges: [{ itemId: 'item-1', change: { operation: 'replace', revision: 0, file } }],
      }),
    );
    http.expectOne('http://localhost:8083/admin/orders/order-1').flush({ order, mailSent: false });
    http
      .expectOne(imageUrl)
      .flush({ error: { code: 'IMAGE_UPLOAD_FAILED' } }, { status: 500, statusText: 'Failed' });
    expect(jobs()[0]).toMatchObject({ status: 'error', errorCode: 'IMAGE_UPLOAD_FAILED' });
    store.dispatch(actions.retryClicked({ id: jobs()[0].id }));
    http.expectNone('http://localhost:8083/admin/orders/order-1');
    http.expectOne(imageUrl).flush({ revision: 1, image: null });
    expect(jobs()[0].status).toBe('success');
  });

  it('serializes transfers and uses the resulting revision for a queued change to the same wish', () => {
    const removal: QueuedImageTransfer = {
      ...job('transfer-2'),
      change: { operation: 'remove', revision: 0 },
    };
    store.dispatch(
      actions.transfersQueued({ transfers: [job(), removal, job('transfer-3', 'item-2')] }),
    );
    const first = http.expectOne(imageUrl);
    http.expectNone(imageUrl.replace('item-1', 'item-2'));
    first.flush({ revision: 1, image: null });
    const second = http.expectOne(imageUrl);
    expect(second.request.method).toBe('DELETE');
    expect(second.request.body).toEqual({ revision: 1 });
    second.flush({ revision: 2, image: null });
    http.expectOne(imageUrl.replace('item-1', 'item-2')).flush({ revision: 1, image: null });
    expect(jobs().map((transfer) => transfer.status)).toEqual(['success', 'success', 'success']);
  });

  it('keeps the queue alive after failure and does not automatically overwrite a revision conflict', () => {
    store.dispatch(actions.transfersQueued({ transfers: [job(), job('transfer-2', 'item-2')] }));
    http
      .expectOne(imageUrl)
      .flush(
        { error: { code: 'IMAGE_REVISION_CONFLICT' } },
        { status: 409, statusText: 'Conflict' },
      );
    http.expectOne(imageUrl.replace('item-1', 'item-2')).flush({ revision: 1, image: null });
    expect(jobs()[0]).toMatchObject({ status: 'error', errorCode: 'IMAGE_REVISION_CONFLICT' });
    expect(jobs()[1].status).toBe('success');
    http.expectNone(imageUrl);
  });

  it('does not invent a percentage when the server omits the upload total', () => {
    store.dispatch(actions.transfersQueued({ transfers: [job()] }));
    const request = http.expectOne(imageUrl);
    request.event({ type: HttpEventType.UploadProgress, loaded: 100 });
    expect(jobs()[0]).toMatchObject({ status: 'uploading', percent: 0 });
    request.flush({ revision: 1, image: null });
  });

  it('treats an empty persistence response as failure rather than leaving an unfinished upload', () => {
    store.dispatch(actions.transfersQueued({ transfers: [job()] }));
    http.expectOne(imageUrl).flush(null);
    expect(jobs()[0]).toMatchObject({ status: 'error', errorCode: 'INVALID_IMAGE_RESPONSE' });
  });

  it('cancels active requests and drops queued files on logout or session expiry', () => {
    for (const action of [AuthActions.logoutRequested(), SessionActions.sessionExpired()]) {
      store.dispatch(actions.transfersQueued({ transfers: [job(), job('transfer-2', 'item-2')] }));
      const request = http.expectOne(imageUrl);
      store.dispatch(action);
      expect(request.cancelled).toBe(true);
      expect(jobs()).toEqual([]);
      http.expectNone(imageUrl.replace('item-1', 'item-2'));
    }
  });

  it('does not start a late image upload when the session ends before wish data is saved', () => {
    store.dispatch(
      AdminOrdersActions.save({
        order,
        imageChanges: [{ itemId: 'item-1', change: { operation: 'replace', revision: 0, file } }],
      }),
    );
    const save = http.expectOne('http://localhost:8083/admin/orders/order-1');
    store.dispatch(AuthActions.logoutRequested());
    expect(save.cancelled).toBe(true);
    http.expectNone(imageUrl);
    expect(jobs()).toEqual([]);
  });
});
