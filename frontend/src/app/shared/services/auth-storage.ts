import { FairgateStatus } from '../models/fairgate.model';
import { UserGroup } from '../models/frontend-config.model';

const STORAGE_KEY = 'gaerngschee.auth';

export interface PersistedAuthState {
  userId: string;
  group: UserGroup;
  email?: string | null;
  fairgateUserExists: boolean | null;
  fairgateStatus?: FairgateStatus | null;
  childrenCount: number | null;
  adultsCount: number | null;
  salutation: string | null;
}

export function loadPersistedAuthState(): Partial<PersistedAuthState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const state = JSON.parse(raw) as Partial<PersistedAuthState>;
    if (!isValidPersistedState(state) || 'token' in state) {
      clearPersistedAuthState();
      return {};
    }

    return state;
  } catch {
    clearPersistedAuthState();
    return {};
  }
}

export function persistAuthState(state: PersistedAuthState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

export function clearPersistedAuthState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

function isValidPersistedState(state: Partial<PersistedAuthState>): state is PersistedAuthState {
  return (
    typeof state.userId === 'string' &&
    ['admin', 'user', 'wunschbesteller', 'wunscherfueller'].includes(state.group ?? '') &&
    (state.email === undefined || state.email === null || typeof state.email === 'string') &&
    (state.fairgateUserExists === null || typeof state.fairgateUserExists === 'boolean') &&
    (state.fairgateStatus === undefined ||
      state.fairgateStatus === null ||
      ['valid', 'not_found', 'expired'].includes(state.fairgateStatus)) &&
    (state.childrenCount === null || typeof state.childrenCount === 'number') &&
    (state.adultsCount === null || typeof state.adultsCount === 'number') &&
    (state.salutation === null || typeof state.salutation === 'string')
  );
}
