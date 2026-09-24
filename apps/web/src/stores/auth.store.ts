import type { AuthSessionDto, UserDto } from '@ecommerce/types';
import { create } from 'zustand';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Marks that this browser has signed in before, so anonymous visitors skip the session refresh.
 * It holds no credentials - the refresh token itself stays in an httpOnly cookie.
 */
const SESSION_HINT_KEY = 'aura-session';

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function setSessionHint(present: boolean): void {
  try {
    if (present) {
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Without storage the app simply always attempts a refresh.
  }
}

interface AuthState {
  status: AuthStatus;
  user: UserDto | null;
  /** Kept in memory only; the refresh token lives in an httpOnly cookie. */
  accessToken: string | null;
  setSession: (session: AuthSessionDto) => void;
  setUser: (user: UserDto) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession: (session) => {
    setSessionHint(true);
    set({ status: 'authenticated', user: session.user, accessToken: session.accessToken });
  },
  setUser: (user) => {
    set({ user });
  },
  clear: () => {
    setSessionHint(false);
    set({ status: 'anonymous', user: null, accessToken: null });
  },
}));
