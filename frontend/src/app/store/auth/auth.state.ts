import { FairgateStatus } from '../../shared/models/fairgate.model';
import { UserGroup } from '../../shared/models/frontend-config.model';
import { loadPersistedAuthState } from '../../shared/services/auth-storage';

const persistedAuth = loadPersistedAuthState();

export interface AuthState {
  userId: string | null;
  group: UserGroup | null;
  requiredPasswordReset: boolean;
  loading: boolean;
  emailCheckLoading: boolean;
  emailCheckMode: 'password' | 'email_sent' | 'info' | null;
  emailCheckEmail: string | null;
  emailCheckYear: number | null;
  emailCheckErrorCode: string | null;
  passwordChangeLoading: boolean;
  passwordChangeErrorCode: string | null;
  errorCode: string | null;
  registrationLoginLoading: boolean;
  registrationLoginErrorCode: string | null;
  fairgateUserExists: boolean | null;
  fairgateStatus: FairgateStatus | null;
  childrenCount: number | null;
  adultsCount: number | null;
  salutation: string | null;
  sessionExpiresAt: string | null;
  sessionSecondsRemaining: number | null;
  sessionWarningVisible: boolean;
  sessionRefreshLoading: boolean;
  email: string | null;
}

export const initialState: AuthState = {
  userId: persistedAuth.userId ?? null,
  group: persistedAuth.group ?? null,
  requiredPasswordReset: false,
  loading: false,
  emailCheckLoading: false,
  emailCheckMode: null,
  emailCheckEmail: null,
  emailCheckYear: null,
  emailCheckErrorCode: null,
  passwordChangeLoading: false,
  passwordChangeErrorCode: null,
  errorCode: null,
  registrationLoginLoading: false,
  registrationLoginErrorCode: null,
  fairgateUserExists: persistedAuth.fairgateUserExists ?? null,
  fairgateStatus: persistedAuth.fairgateStatus ?? null,
  childrenCount: persistedAuth.childrenCount ?? null,
  adultsCount: persistedAuth.adultsCount ?? null,
  salutation: persistedAuth.salutation ?? null,
  sessionExpiresAt: null,
  sessionSecondsRemaining: null,
  sessionWarningVisible: false,
  sessionRefreshLoading: false,
  email: persistedAuth.email ?? null,
};

export const loggedOutState: AuthState = {
  ...initialState,
  userId: null,
  group: null,
  requiredPasswordReset: false,
  fairgateUserExists: null,
  fairgateStatus: null,
  childrenCount: null,
  adultsCount: null,
  salutation: null,
  sessionExpiresAt: null,
  sessionSecondsRemaining: null,
  sessionWarningVisible: false,
  sessionRefreshLoading: false,
  email: null,
};
