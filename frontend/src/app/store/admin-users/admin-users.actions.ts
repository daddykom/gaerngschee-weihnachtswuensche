import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UserGroup } from '../../shared/models/frontend-config.model';
import { AdminUser } from '../../shared/services/admin-users.service';

export const AdminUsersActions = createActionGroup({
  source: 'Admin Users',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ users: AdminUser[] }>(),
    'Load Failure': props<{ errorCode: string }>(),
    Create: props<{ email: string; group: UserGroup }>(),
    'Create Success': props<{ user: AdminUser; emailSentTo: string }>(),
    'Create Failure': props<{ errorCode: string }>(),
    Update: props<{
      userId: string;
      changes: Partial<Pick<AdminUser, 'email' | 'group' | 'required_password_reset'>>;
    }>(),
    'Update Success': props<{ user: AdminUser; emailSentTo: string | null }>(),
    'Update Failure': props<{ errorCode: string }>(),
    Delete: props<{ userId: string }>(),
    'Delete Success': props<{ userId: string }>(),
    'Delete Failure': props<{ errorCode: string }>(),
    'Send Password Reset': props<{ userId: string }>(),
    'Send Password Reset Success': props<{ emailSentTo: string }>(),
    'Send Password Reset Failure': props<{ errorCode: string }>(),
  },
});
