import { createFeature, createReducer, on } from '@ngrx/store';
import { AdminUsersActions } from './admin-users.actions';
import { AdminUsersState, initialState } from './admin-users.state';

export const adminUsersFeature = createFeature({
  name: 'adminUsers',
  reducer: createReducer<AdminUsersState>(
    initialState,
    on(AdminUsersActions.load, (state) => ({
      ...state,
      loadStatus: 'loading',
      errorCode: null,
    })),
    on(AdminUsersActions.loadSuccess, (state, { users }) => ({
      ...state,
      users,
      loadStatus: 'loaded',
    })),
    on(AdminUsersActions.loadFailure, (state, { errorCode }) => ({
      ...state,
      loadStatus: 'error',
      errorCode,
    })),
    on(AdminUsersActions.loadUser, AdminUsersActions.loadProfile, (state) => ({
      ...state,
      selectedUser: null,
      detailStatus: 'loading',
      detailErrorCode: null,
    })),
    on(AdminUsersActions.loadUserSuccess, (state, { user }) => ({
      ...state,
      selectedUser: user,
      detailStatus: 'loaded',
    })),
    on(AdminUsersActions.loadUserFailure, (state, { errorCode }) => ({
      ...state,
      detailStatus: 'error',
      detailErrorCode: errorCode,
    })),
    on(
      AdminUsersActions.create,
      AdminUsersActions.update,
      AdminUsersActions.updateProfile,
      AdminUsersActions.delete,
      AdminUsersActions.sendPasswordReset,
      (state) => ({
        ...state,
        saveStatus: 'loading',
        errorCode: null,
      }),
    ),
    on(AdminUsersActions.createSuccess, (state, { user }) => ({
      ...state,
      users: [user, ...state.users],
      saveStatus: 'success',
    })),
    on(AdminUsersActions.updateSuccess, (state, { user }) => ({
      ...state,
      selectedUser: user,
      users: state.users.map((current) => (current.id === user.id ? user : current)),
      saveStatus: 'success',
    })),
    on(AdminUsersActions.updateProfileSuccess, (state, { user }) => ({
      ...state,
      selectedUser: user,
      users: state.users.map((current) => (current.id === user.id ? user : current)),
      saveStatus: 'success',
    })),
    on(AdminUsersActions.deleteSuccess, (state, { userId }) => ({
      ...state,
      users: state.users.filter((user) => user.id !== userId),
      saveStatus: 'success',
    })),
    on(
      AdminUsersActions.createFailure,
      AdminUsersActions.updateFailure,
      AdminUsersActions.updateProfileFailure,
      AdminUsersActions.deleteFailure,
      AdminUsersActions.sendPasswordResetFailure,
      (state, action) => ({
        ...state,
        saveStatus: 'error',
        errorCode: action.errorCode,
      }),
    ),
  ),
});

export const {
  name: adminUsersFeatureName,
  reducer: adminUsersReducer,
  selectUsers: selectAdminUsers,
  selectSelectedUser: selectAdminUsersSelectedUser,
  selectDetailStatus: selectAdminUsersDetailStatus,
  selectLoadStatus: selectAdminUsersLoadStatus,
  selectSaveStatus: selectAdminUsersSaveStatus,
} = adminUsersFeature;

export const selectAdminUsersLoading = (state: { adminUsers: AdminUsersState }): boolean =>
  state.adminUsers.loadStatus === 'loading';

export const selectAdminUsersSaving = (state: { adminUsers: AdminUsersState }): boolean =>
  state.adminUsers.saveStatus === 'loading';

export const selectAdminUsersDetailLoading = (state: { adminUsers: AdminUsersState }): boolean =>
  state.adminUsers.detailStatus === 'loading';
