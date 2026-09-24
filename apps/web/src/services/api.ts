import { authSessionSchema } from '@ecommerce/types';

import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/auth.store';

import { createApiClient } from './api-client';

/** Shared client: attaches the in-memory access token and renews it through the refresh cookie. */
export const api = createApiClient({
  baseUrl: `${env.VITE_API_BASE_URL}/api`,
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: async () => {
    try {
      const session = await api.request('/auth/refresh', authSessionSchema, {
        method: 'POST',
        retryOnUnauthorized: false,
      });
      useAuthStore.getState().setSession(session);
      return session.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    }
  },
});
