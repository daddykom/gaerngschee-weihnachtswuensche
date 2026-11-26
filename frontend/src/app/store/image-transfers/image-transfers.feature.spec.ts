import { AuthActions } from '../auth/auth.actions';
import { SessionActions } from '../auth/session.actions';
import { ImageTransfersActions as actions } from './image-transfers.actions';
import { imageTransfersFeature } from './image-transfers.feature';
import { initialImageTransfersState, QueuedImageTransfer } from './image-transfers.state';

describe('imageTransfersFeature', () => {
  const reducer = imageTransfersFeature.reducer;
  const file = new File(['image'], 'gift.png', { type: 'image/png' });
  const job: QueuedImageTransfer = {
    id: 'transfer-1',
    orderId: 'order-1',
    itemId: 'item-1',
    status: 'queued',
    change: { operation: 'replace', revision: 0, file },
  };
  const queued = () =>
    reducer(initialImageTransfersState, actions.transfersQueued({ transfers: [job] }));
  const uploading = () => reducer(queued(), actions.transferStarted({ id: job.id }));

  it('queues jobs immutably without duplicating known transfer IDs', () => {
    const state = queued();
    expect(initialImageTransfersState.transfers).toEqual([]);
    expect(state.transfers).toEqual([job]);
    expect(reducer(state, actions.transfersQueued({ transfers: [job] })).transfers).toHaveLength(1);
  });

  it('tracks monotonic bounded progress and stays uploading at 100 percent', () => {
    let state = uploading();
    for (const percent of [22.9, 10, NaN, 125]) {
      state = reducer(state, actions.transferProgressed({ id: job.id, percent }));
    }
    expect(state.transfers[0]).toMatchObject({ status: 'uploading', percent: 100 });
    state = reducer(
      state,
      actions.transferSucceeded({ id: job.id, result: { revision: 1, image: null } }),
    );
    expect(state.transfers[0]).toEqual({
      id: job.id,
      orderId: job.orderId,
      itemId: job.itemId,
      status: 'success',
      result: { revision: 1, image: null },
    });
    expect(state.transfers[0]).not.toHaveProperty('change');
    expect(reducer(state, actions.transferProgressed({ id: job.id, percent: 99 }))).toEqual(state);
  });

  it('retains failed image changes for explicit retry and releases them on dismissal', () => {
    const failed = reducer(
      uploading(),
      actions.transferFailed({ id: job.id, errorCode: 'OFFLINE' }),
    );
    expect(failed.transfers[0]).toMatchObject({
      status: 'error',
      errorCode: 'OFFLINE',
      change: { file },
    });
    expect(reducer(failed, actions.retryClicked({ id: job.id })).transfers).toEqual([job]);
    expect(reducer(failed, actions.dismissClicked({ id: job.id })).transfers).toEqual([]);
    expect(reducer(uploading(), actions.dismissClicked({ id: job.id })).transfers).toHaveLength(1);
  });

  it('advances queued revisions only for changes based on this application’s preceding image write', () => {
    const next: QueuedImageTransfer = {
      ...job,
      id: 'transfer-2',
      change: { operation: 'remove', revision: 0 },
    };
    const unrelated = { ...job, id: 'transfer-3', itemId: 'another-item' };
    const differentBase: QueuedImageTransfer = {
      ...job,
      id: 'transfer-4',
      change: { operation: 'remove', revision: 5 },
    };
    let state = reducer(
      initialImageTransfersState,
      actions.transfersQueued({ transfers: [job, next, unrelated, differentBase] }),
    );
    state = reducer(state, actions.transferStarted({ id: job.id }));
    state = reducer(
      state,
      actions.transferSucceeded({ id: job.id, result: { revision: 1, image: null } }),
    );
    expect(state.transfers[1]).toMatchObject({
      status: 'queued',
      change: { operation: 'remove', revision: 1 },
    });
    expect(state.transfers[2]).toEqual(unrelated);
    expect(state.transfers[3]).toEqual(differentBase);
  });

  it('clears files and job metadata on logout, session expiry or account changes', () => {
    for (const action of [
      AuthActions.logoutRequested(),
      AuthActions.logoutRequestedWithRedirect({ target: '/' }),
      AuthActions.loginSuccess({ userId: 'other', group: 'admin', requiredPasswordReset: false }),
      SessionActions.sessionExpired(),
    ]) {
      expect(reducer(uploading(), action)).toEqual(initialImageTransfersState);
    }
  });
});
