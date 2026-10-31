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
    on(FulfillerOrdersActions.reserve, (state) => ({
      ...state,
      reserveStatus: 'loading',
      reserveErrorCode: null,
    })),
    on(FulfillerOrdersActions.reserveSuccess, (state, { orderId, itemId, reservedAt }) => ({
      ...state,
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) =>
                item.id === itemId
                  ? { ...item, fulfillmentStatus: 'reserved' as const, reservedAt }
                  : item,
              ),
            },
      ),
      reserveStatus: 'success',
      reserveErrorCode: null,
    })),
    on(FulfillerOrdersActions.reserveFailure, (state, { errorCode }) => ({
      ...state,
      reserveStatus: 'error',
      reserveErrorCode: errorCode,
    })),
  ),
});

export const {
  selectOrders: selectFulfillerOrders,
  selectSearch: selectFulfillerOrdersSearch,
  selectCategory: selectFulfillerOrdersCategory,
  selectLoadStatus: selectFulfillerOrdersLoadStatus,
  selectReserveStatus: selectFulfillerOrdersReserveStatus,
} = fulfillerOrdersFeature;
