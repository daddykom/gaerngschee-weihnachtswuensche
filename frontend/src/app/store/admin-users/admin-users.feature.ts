import { createFeature, createReducer, on } from '@ngrx/store';
import { AdminUsersActions } from './admin-users.actions';
import { AdminUsersState, initialState } from './admin-users.state';

export const adminUsersFeature = createFeature({
  name: 'adminUsers',
  reducer: createReducer<AdminUsersState>(
    initialState,
    on(AdminUsersActions.load, (state) => ({
      ...state,
      loading: true,
    })),
    on(AdminUsersActions.loadSuccess, (state, { users }) => ({
      ...state,
      users,
      loading: false,
    })),
    on(AdminUsersActions.loadFailure, (state) => ({
      ...state,
      loading: false,
    })),
    on(AdminUsersActions.create, AdminUsersActions.update, AdminUsersActions.delete, AdminUsersActions.sendPasswordReset, (state) => ({
      ...state,
      saving: true,
    })),
    on(AdminUsersActions.createSuccess, (state, { user }) => ({
      ...state,
      users: [user, ...state.users],
      saving: false,
    })),
    on(AdminUsersActions.updateSuccess, (state, { user }) => ({
      ...state,
      users: state.users.map((current) => current.id === user.id ? user : current),
      saving: false,
    })),
    on(AdminUsersActions.deleteSuccess, (state, { userId }) => ({
      ...state,
      users: state.users.filter((user) => user.id !== userId),
      saving: false,
    })),
    on(AdminUsersActions.createFailure, AdminUsersActions.updateFailure, AdminUsersActions.deleteFailure, AdminUsersActions.sendPasswordResetFailure, (state) => ({
      ...state,
      saving: false,
    })),
  ),
});

export const {
  name: adminUsersFeatureName,
  reducer: adminUsersReducer,
  selectUsers: selectAdminUsers,
  selectLoading: selectAdminUsersLoading,
  selectSaving: selectAdminUsersSaving,
} = adminUsersFeature;
