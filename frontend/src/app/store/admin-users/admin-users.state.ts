import { AdminUser } from '../../shared/services/admin-users.service';

export interface AdminUsersState {
  users: AdminUser[];
  loading: boolean;
  saving: boolean;
}

export const initialState: AdminUsersState = {
  users: [],
  loading: false,
  saving: false,
};
