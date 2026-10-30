import { AdminUser } from '../../shared/services/admin-users.service';

export interface AdminUserForm {
  email: string;
  group: 'admin' | 'user';
  requiredPasswordReset: boolean;
}

export interface AdminUsersState {
  form: AdminUserForm;
  users: AdminUser[];
  selectedUser: AdminUser | null;
  detailStatus: 'initial' | 'loading' | 'loaded' | 'error';
  loadStatus: 'initial' | 'loading' | 'loaded' | 'error';
  saveStatus: 'initial' | 'loading' | 'success' | 'error';
  errorCode: string | null;
  detailErrorCode: string | null;
}

export const initialState: AdminUsersState = {
  form: { email: '', group: 'user', requiredPasswordReset: false },
  users: [],
  selectedUser: null,
  detailStatus: 'initial',
  loadStatus: 'initial',
  saveStatus: 'initial',
  errorCode: null,
  detailErrorCode: null,
};
