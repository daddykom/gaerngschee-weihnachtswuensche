import { AdminUser } from '../../shared/services/admin-users.service';

export interface AdminUsersState {
  users: AdminUser[];
  selectedUser: AdminUser | null;
  detailStatus: 'initial' | 'loading' | 'loaded' | 'error';
  loadStatus: 'initial' | 'loading' | 'loaded' | 'error';
  saveStatus: 'initial' | 'loading' | 'success' | 'error';
  errorCode: string | null;
  detailErrorCode: string | null;
}

export const initialState: AdminUsersState = {
  users: [],
  selectedUser: null,
  detailStatus: 'initial',
  loadStatus: 'initial',
  saveStatus: 'initial',
  errorCode: null,
  detailErrorCode: null,
};
