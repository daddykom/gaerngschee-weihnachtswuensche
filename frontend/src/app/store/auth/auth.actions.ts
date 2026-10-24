import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { FairgateStatus } from '../../shared/models/fairgate.model';
import { UserGroup } from '../../shared/models/frontend-config.model';
import { EmailCheckMode } from '../../shared/services/auth.service';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Check Email': props<{ email: string }>(),
    'Check Email Success': props<{ email: string; mode: EmailCheckMode; processingYear: number }>(),
    'Check Email Failure': props<{ errorCode: string }>(),
    Login: props<{ email: string; password: string }>(),
    'Login Success': props<{
      userId: string;
      group: UserGroup;
      requiredPasswordReset: boolean;
      email?: string;
    }>(),
    'Login Failure': props<{ errorCode: string }>(),
    'Registration Login': props<{ token: string }>(),
    'Registration Login Success': props<{
      userId: string;
      email: string;
      group: UserGroup;
      fairgateStatus?: FairgateStatus;
      fairgateUserExists: boolean;
      childrenCount: number;
      adultsCount: number;
      salutation: string;
      firstAccess: boolean;
    }>(),
    'Registration Login Failure': props<{ errorCode: string }>(),
    'Password Change': props<{ password: string }>(),
    'Password Change Success': emptyProps(),
    'Password Change Failure': props<{ errorCode: string }>(),
    'Password Reset Request': props<{ email: string }>(),
    'Password Reset Request Success': emptyProps(),
    'Password Reset Request Failure': props<{ errorCode: string }>(),
    'Password Reset': props<{ token: string; password: string }>(),
    'Password Reset Success': emptyProps(),
    'Password Reset Failure': props<{ errorCode: string }>(),
    'Logout Requested': emptyProps(),
  },
});
