import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { AuthActions } from '../auth/auth.actions';
import { SessionActions } from '../auth/session.actions';
import { AdminOrdersActions } from './admin-orders.actions';
import { AdminOrdersState, initialState } from './admin-orders.state';

export const adminOrdersFeature = createFeature({
  name: 'adminOrders',
  reducer: createReducer<AdminOrdersState>(
    initialState,
    on(
      AdminOrdersActions.imageEditorEntered,
      AdminOrdersActions.imageReloadClicked,
      (state, { orderId, itemId }) => ({
        ...state,
        itemImage: { status: 'loading', orderId, itemId },
      }),
    ),
    on(AdminOrdersActions.imageLoaded, (state, { orderId, itemId, data, blob }) => ({
      ...state,
      itemImage: { status: 'loaded', orderId, itemId, data, blob },
    })),
    on(AdminOrdersActions.imageLoadFailed, (state, { orderId, itemId, errorCode }) => ({
      ...state,
      itemImage: { status: 'error', orderId, itemId, errorCode },
    })),
    on(
      AuthActions.logoutRequested,
      AuthActions.logoutRequestedWithRedirect,
      SessionActions.sessionExpired,
      (state) => ({ ...state, itemImage: { status: 'initial' } }),
    ),
    on(AdminOrdersActions.load, (state) => ({
      ...state,
      loadStatus: 'loading',
      errorCode: null,
      activeOrderId: null,
      form: null,
    })),
    on(AdminOrdersActions.searchFormChanged, (state, { changes }) => ({
      ...state,
      searchForm: { ...state.searchForm, ...changes },
    })),
    on(AdminOrdersActions.filtersChanged, (state, { statuses, categories }) => ({
      ...state,
      statuses,
      categories,
      loadStatus: 'loading',
      errorCode: null,
      activeOrderId: null,
      form: null,
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
      activeOrderId: null,
      form: null,
    })),
    on(AdminOrdersActions.saveFailure, (state, { errorCode }) => ({
      ...state,
      saveStatus: 'error',
      errorCode,
    })),
  ),
  extraSelectors: ({ selectOrders, selectSearchForm }) => ({
    selectFilteredOrders: createSelector(selectOrders, selectSearchForm, (orders, searchForm) => {
      const search = searchForm.email.trim().toLowerCase();
      const orderNumber = searchForm.orderNumber.trim();
      return orders.filter(
        (order) =>
          (order.requesterEmail.toLowerCase().includes(search) ||
            order.items.some((item) => item.fulfillerEmail?.toLowerCase().includes(search))) &&
          (orderNumber === '' ||
            (/^\d+$/.test(orderNumber) && order.orderNumber === Number(orderNumber))),
      );
    }),
  }),
});

export const {
  selectItemImage: selectAdminItemImage,
  selectOrders: selectAdminOrders,
  selectFilteredOrders: selectAdminFilteredOrders,
  selectSearchForm: selectAdminOrderSearchForm,
  selectStatuses: selectAdminOrderStatuses,
  selectCategories: selectAdminOrderCategories,
  selectLoadStatus: selectAdminOrdersLoadStatus,
  selectSaveStatus: selectAdminOrdersSaveStatus,
  selectActiveOrderId: selectAdminOrdersActiveOrderId,
  selectForm: selectAdminOrdersForm,
} = adminOrdersFeature;
