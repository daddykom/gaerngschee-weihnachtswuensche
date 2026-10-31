import { createFeature, createReducer, on } from '@ngrx/store';
import { AdminOrdersActions } from './admin-orders.actions';
import { AdminOrdersState, initialState } from './admin-orders.state';

export const adminOrdersFeature = createFeature({
  name: 'adminOrders',
  reducer: createReducer<AdminOrdersState>(
    initialState,
    on(AdminOrdersActions.load, (state) => ({ ...state, loadStatus: 'loading', errorCode: null })),
    on(AdminOrdersActions.filtersChanged, (state, { statuses, categories }) => ({
      ...state,
      statuses,
      categories,
      loadStatus: 'loading',
      errorCode: null,
    })),
    on(AdminOrdersActions.loadSuccess, (state, { orders }) => ({
      ...state,
      orders,
      loadStatus: 'loaded',
    })),
    on(AdminOrdersActions.loadFailure, (state, { errorCode }) => ({
      ...state,
      loadStatus: 'error',
      errorCode,
    })),
    on(AdminOrdersActions.save, (state) => ({ ...state, saveStatus: 'loading', errorCode: null })),
    on(AdminOrdersActions.draftChanged, (state, { order }) => ({
      ...state,
      orders: state.orders.map((current) => (current.id === order.id ? order : current)),
    })),
    on(AdminOrdersActions.formLoaded, (state, { orderId, form }) => ({
      ...state,
      activeOrderId: orderId,
      form,
    })),
    on(AdminOrdersActions.formChanged, (state, { orderId, changes }) =>
      state.activeOrderId !== orderId || state.form === null
        ? state
        : {
            ...state,
            form: { ...state.form, ...changes },
          },
    ),
    on(AdminOrdersActions.saveSuccess, (state, { order }) => ({
      ...state,
      orders: state.orders.map((current) => (current.id === order.id ? order : current)),
      saveStatus: 'success',
    })),
    on(AdminOrdersActions.saveFailure, (state, { errorCode }) => ({
      ...state,
      saveStatus: 'error',
      errorCode,
    })),
  ),
});

export const {
  selectOrders: selectAdminOrders,
  selectStatuses: selectAdminOrderStatuses,
  selectCategories: selectAdminOrderCategories,
  selectLoadStatus: selectAdminOrdersLoadStatus,
  selectSaveStatus: selectAdminOrdersSaveStatus,
  selectActiveOrderId: selectAdminOrdersActiveOrderId,
  selectForm: selectAdminOrdersForm,
} = adminOrdersFeature;
