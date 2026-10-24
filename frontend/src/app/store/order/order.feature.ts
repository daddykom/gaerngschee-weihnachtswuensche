import { createFeature, createReducer, on } from '@ngrx/store';
import { OrderActions } from './order.actions';
import { initialState, OrderState } from './order.state';

export const orderFeature = createFeature({
  name: 'order',
  reducer: createReducer<OrderState>(
    initialState,
    on(OrderActions.load, (state) => ({ ...state, status: 'loading', errorCode: null })),
    on(OrderActions.loadSuccess, (state, { overview }) => ({
      ...state,
      status: 'loaded',
      order: overview.order,
      year: overview.year,
      fairgateStatus: overview.fairgateStatus,
      fairgateUserExists: overview.fairgateUserExists,
      childrenCount: overview.childrenCount,
      adultsCount: overview.adultsCount,
      form: {
        ...state.form,
        adultsCount: overview.order?.adultsCount ?? overview.adultsCount,
        childrenCount: overview.order?.childrenCount ?? overview.childrenCount,
        text: overview.order?.currentText ?? '',
      },
      errorCode: null,
    })),
    on(OrderActions.loadFailure, (state, { errorCode }) => ({
      ...state,
      status: 'error',
      errorCode,
    })),
    on(OrderActions.formChanged, (state, { changes }) => ({
      ...state,
      form: { ...state.form, ...changes },
    })),
  ),
});

export const {
  name: orderFeatureName,
  reducer: orderReducer,
  selectStatus: selectOrderStatus,
  selectOrder,
  selectYear: selectOrderYear,
  selectFairgateStatus: selectOrderFairgateStatus,
  selectFairgateUserExists: selectOrderFairgateUserExists,
  selectChildrenCount: selectOrderChildrenCount,
  selectAdultsCount: selectOrderAdultsCount,
  selectForm: selectOrderForm,
  selectErrorCode: selectOrderErrorCode,
} = orderFeature;
