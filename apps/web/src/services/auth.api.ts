import { authSessionSchema, messageSchema, userSchema } from '@ecommerce/types';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '@ecommerce/validation';

import { api } from './api';

export const authApi = {
  register: (input: RegisterInput) =>
    api.request('/auth/register', authSessionSchema, { method: 'POST', body: input }),
  login: (input: LoginInput) =>
    api.request('/auth/login', authSessionSchema, {
      method: 'POST',
      body: input,
      retryOnUnauthorized: false,
    }),
  refresh: () =>
    api.request('/auth/refresh', authSessionSchema, {
      method: 'POST',
      retryOnUnauthorized: false,
    }),
  logout: () => api.send('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
  me: () => api.request('/auth/me', userSchema),
  updateProfile: (input: UpdateProfileInput) =>
    api.request('/auth/me', userSchema, { method: 'PATCH', body: input }),
  changePassword: (input: ChangePasswordInput) =>
    api.request('/auth/change-password', authSessionSchema, { method: 'POST', body: input }),
  forgotPassword: (email: string) =>
    api.request('/auth/forgot-password', messageSchema, { method: 'POST', body: { email } }),
  resetPassword: (input: ResetPasswordInput) =>
    api.request('/auth/reset-password', messageSchema, { method: 'POST', body: input }),
  verifyEmail: (token: string) =>
    api.request('/auth/verify-email', userSchema, { method: 'POST', body: { token } }),
  resendVerification: () =>
    api.request('/auth/verify-email/resend', messageSchema, { method: 'POST' }),
};
