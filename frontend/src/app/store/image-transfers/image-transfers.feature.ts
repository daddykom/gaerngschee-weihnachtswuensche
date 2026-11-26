import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { AuthActions } from '../auth/auth.actions';
import { SessionActions } from '../auth/session.actions';
import { ImageTransfersActions } from './image-transfers.actions';
import {
  ImageTransfer,
  ImageTransfersState,
  initialImageTransfersState,
} from './image-transfers.state';

export const imageTransfersFeature = createFeature({
  name: 'imageTransfers',
  reducer: createReducer<ImageTransfersState>(
    initialImageTransfersState,
    on(ImageTransfersActions.transfersQueued, (state, { transfers }) => ({
      ...state,
      transfers: [
        ...state.transfers,
        ...transfers.filter(
          (transfer) => !state.transfers.some((current) => current.id === transfer.id),
        ),
      ],
    })),
    on(ImageTransfersActions.transferStarted, (state, { id }) => ({
      ...state,
      transfers: state.transfers.map(
        (transfer): ImageTransfer =>
          transfer.id === id && transfer.status === 'queued'
            ? { ...transfer, status: 'uploading', percent: 0 }
            : transfer,
      ),
    })),
    on(ImageTransfersActions.transferProgressed, (state, { id, percent }) => ({
      ...state,
      transfers: state.transfers.map((transfer) =>
        transfer.id === id && transfer.status === 'uploading' && Number.isFinite(percent)
          ? {
              ...transfer,
              percent: Math.max(transfer.percent, Math.min(100, Math.max(0, Math.floor(percent)))),
            }
          : transfer,
      ),
    })),
    on(ImageTransfersActions.transferSucceeded, (state, { id, result }) => {
      const completed = state.transfers.find((transfer) => transfer.id === id);
      if (completed?.status !== 'uploading') return state;
      return {
        ...state,
        transfers: state.transfers.map((transfer): ImageTransfer => {
          if (transfer.id === id) {
            // Release the file after the backend confirms persistence.
            return {
              id,
              orderId: transfer.orderId,
              itemId: transfer.itemId,
              status: 'success',
              result,
            };
          }
          if (
            transfer.status === 'queued' &&
            transfer.orderId === completed.orderId &&
            transfer.itemId === completed.itemId &&
            transfer.change.revision === completed.change.revision
          ) {
            return { ...transfer, change: { ...transfer.change, revision: result.revision } };
          }
          return transfer;
        }),
      };
    }),
    on(ImageTransfersActions.transferFailed, (state, { id, errorCode }) => ({
      ...state,
      transfers: state.transfers.map(
        (transfer): ImageTransfer =>
          transfer.id === id && transfer.status === 'uploading'
            ? {
                id,
                orderId: transfer.orderId,
                itemId: transfer.itemId,
                status: 'error',
                change: transfer.change,
                errorCode,
              }
            : transfer,
      ),
    })),
    on(ImageTransfersActions.retryClicked, (state, { id }) => ({
      ...state,
      transfers: state.transfers.map(
        (transfer): ImageTransfer =>
          transfer.id === id && transfer.status === 'error'
            ? {
                id,
                orderId: transfer.orderId,
                itemId: transfer.itemId,
                status: 'queued',
                change: transfer.change,
              }
            : transfer,
      ),
    })),
    on(ImageTransfersActions.dismissClicked, (state, { id }) => ({
      ...state,
      transfers: state.transfers.filter(
        (transfer) =>
          transfer.id !== id || transfer.status === 'queued' || transfer.status === 'uploading',
      ),
    })),
    on(
      AuthActions.logoutRequested,
      AuthActions.logoutRequestedWithRedirect,
      AuthActions.loginSuccess,
      AuthActions.registrationLoginSuccess,
      SessionActions.sessionExpired,
      () => initialImageTransfersState,
    ),
  ),
  extraSelectors: ({ selectTransfers }) => ({
    selectHasPendingTransfers: createSelector(selectTransfers, (transfers) =>
      transfers.some((transfer) => transfer.status === 'queued' || transfer.status === 'uploading'),
    ),
  }),
});

export const {
  selectTransfers: selectImageTransfers,
  selectHasPendingTransfers: selectHasPendingImageTransfers,
} = imageTransfersFeature;
