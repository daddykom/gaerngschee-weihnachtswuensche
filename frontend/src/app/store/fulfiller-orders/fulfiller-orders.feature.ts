import { createFeature, createReducer, on } from '@ngrx/store';
import { FulfillerOrdersActions } from './fulfiller-orders.actions';
import { FulfillerOrdersState, initialState } from './fulfiller-orders.state';

export const fulfillerOrdersFeature = createFeature({
  name: 'fulfillerOrders',
  reducer: createReducer<FulfillerOrdersState>(
    initialState,
    on(FulfillerOrdersActions.load, (state) => ({
      ...state,
      loadStatus: 'loading',
      errorCode: null,
    })),
    on(FulfillerOrdersActions.searchChanged, (state, { search }) => ({
      ...state,
      search,
      loadStatus: search.trim().length >= 3 || search.trim() === '' ? 'loading' : state.loadStatus,
      errorCode: null,
    })),
    on(FulfillerOrdersActions.categoryChanged, (state, { category }) => ({
      ...state,
      category,
      loadStatus: 'loading',
      errorCode: null,
    })),
    on(FulfillerOrdersActions.loadSuccess, (state, { orders }) => ({
      ...state,
      orders,
      loadStatus: 'loaded',
      errorCode: null,
    })),
    on(FulfillerOrdersActions.loadFailure, (state, { errorCode }) => ({
      ...state,
      loadStatus: 'error',
      errorCode,
    })),
    on(FulfillerOrdersActions.reservationStarted, (state, { itemId }) => ({
      ...state,
      reservationForm: { itemId, email: '', privacyAccepted: false },
      reservationStatus: 'initial' as const,
      reservationErrorCode: null,
    })),
    on(FulfillerOrdersActions.reservationFormChanged, (state, { changes }) => ({
      ...state,
      reservationForm: { ...state.reservationForm, ...changes },
    })),
    on(FulfillerOrdersActions.reservationSubmitted, (state) => ({
      ...state,
      reservationStatus: 'loading' as const,
      reservationErrorCode: null,
    })),
    on(
      FulfillerOrdersActions.reservationRequestSuccess,
      (state, { itemId, reservationExpiresAt }) => ({
        ...state,
        orders: state.orders.map((order) =>
          !order.items.some((item) => item.id === itemId)
            ? order
            : {
                ...order,
                items: order.items.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        fulfillmentStatus: 'pending_confirmation' as const,
                        reservationExpiresAt,
                      }
                    : item,
                ),
              },
        ),
        reservationStatus: 'success' as const,
        reservationErrorCode: null,
      }),
    ),
    on(FulfillerOrdersActions.reservationRequestFailure, (state, { errorCode }) => ({
      ...state,
      reservationStatus: 'error' as const,
      reservationErrorCode: errorCode,
    })),
    on(FulfillerOrdersActions.wishStatusesUpdated, (state, { items }) => ({
      ...state,
      orders: state.orders.map((order) => ({
        ...order,
        items: order.items.map((item) => {
          const update = items.find((candidate) => candidate.id === item.id);
          return update
            ? {
                ...item,
                fulfillmentStatus: update.fulfillmentStatus,
                reservedAt: update.reservedAt,
                reservationExpiresAt: update.reservationExpiresAt,
              }
            : item;
        }),
      })),
    })),
  ),
});

export const {
  selectOrders: selectFulfillerOrders,
  selectSearch: selectFulfillerOrdersSearch,
  selectCategory: selectFulfillerOrdersCategory,
  selectLoadStatus: selectFulfillerOrdersLoadStatus,
  selectReservationForm: selectFulfillerReservationForm,
  selectReservationStatus: selectFulfillerReservationStatus,
  selectReservationErrorCode: selectFulfillerReservationErrorCode,
} = fulfillerOrdersFeature;
