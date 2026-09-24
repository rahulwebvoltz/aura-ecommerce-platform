import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createUser, DEFAULT_PASSWORD } from '../../test/factories.js';
import {
  createTestContext,
  dataOf,
  disconnect,
  errorCodeOf,
  extractRefreshCookie,
  login,
  resetDatabase,
} from '../../test/harness.js';

const t = createTestContext();
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
});
const sessionSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: userSchema,
});
const csrf = { 'x-requested-with': 'fetch' };

beforeEach(async () => {
  await resetDatabase(t.prisma);
  t.mailer.messages.length = 0;
});
afterAll(disconnect);

describe('register → login', () => {
  it('registers, sets a refresh cookie, and sends a verification email', async () => {
    const response = await request(t.app).post('/api/auth/register').send({
      email: 'New@Example.com',
      password: 'Secret123',
      firstName: 'Asha',
      lastName: 'Rao',
    });

    expect(response.status).toBe(201);
    const session = dataOf(response.body, sessionSchema);
    expect(session.user).toMatchObject({ email: 'new@example.com', emailVerified: false });
    expect(session.expiresIn).toBe(900);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const cookie = z.array(z.string()).parse(response.headers['set-cookie'])[0] ?? '';
    expect(cookie).toMatch(/^refresh_token=.+HttpOnly/u);
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('SameSite=Strict');
    expect(t.mailer.messages[0]?.subject).toBe('Verify your email address');

    const loggedIn = await login(t.app, 'new@example.com', 'Secret123');
    expect(loggedIn.userId).toBe(session.user.id);
  });

  it('rejects duplicate emails and invalid input', async () => {
    await createUser(t.prisma, { email: 'taken@example.com' });

    const duplicate = await request(t.app).post('/api/auth/register').send({
      email: 'taken@example.com',
      password: 'Secret123',
      firstName: 'A',
      lastName: 'B',
    });
    expect(duplicate.status).toBe(409);
    expect(errorCodeOf(duplicate.body)).toBe('EMAIL_IN_USE');

    const invalid = await request(t.app).post('/api/auth/register').send({ email: 'x' });
    expect(invalid.status).toBe(422);
    expect(errorCodeOf(invalid.body)).toBe('VALIDATION_ERROR');
  });

  it('rejects wrong passwords and unknown emails with the same error', async () => {
    await createUser(t.prisma, { email: 'known@example.com' });

    for (const email of ['known@example.com', 'unknown@example.com']) {
      const response = await request(t.app)
        .post('/api/auth/login')
        .send({ email, password: 'Wrong1234' });
      expect(response.status).toBe(401);
      expect(errorCodeOf(response.body)).toBe('INVALID_CREDENTIALS');
    }
  });
});

describe('login → refresh token', () => {
  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const user = await createUser(t.prisma);
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);

    const first = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', session.cookie);
    expect(first.status).toBe(200);
    expect(dataOf(first.body, sessionSchema).accessToken).toEqual(expect.any(String));
    const rotated = extractRefreshCookie(first.headers['set-cookie']);
    expect(rotated).not.toBe(session.cookie);

    const replay = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', session.cookie);
    expect(replay.status).toBe(401);
    expect(errorCodeOf(replay.body)).toBe('SESSION_REVOKED');

    const afterReplay = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', rotated);
    expect(afterReplay.status).toBe(401);
  });

  it('requires the CSRF header and a cookie', async () => {
    const withoutHeader = await request(t.app).post('/api/auth/refresh');
    expect(withoutHeader.status).toBe(403);
    expect(errorCodeOf(withoutHeader.body)).toBe('CSRF_HEADER_REQUIRED');

    const withoutCookie = await request(t.app).post('/api/auth/refresh').set(csrf);
    expect(withoutCookie.status).toBe(401);
    expect(errorCodeOf(withoutCookie.body)).toBe('SESSION_EXPIRED');

    const unknown = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', 'refresh_token=unknown');
    expect(errorCodeOf(unknown.body)).toBe('SESSION_EXPIRED');
  });

  it('expires refresh tokens after their lifetime', async () => {
    const user = await createUser(t.prisma);
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);

    t.setNow(new Date(Date.now() + 31 * 86_400_000));
    const response = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', session.cookie);
    t.setNow(null);

    expect(errorCodeOf(response.body)).toBe('SESSION_EXPIRED');
  });

  it('logs out by revoking the refresh token', async () => {
    const user = await createUser(t.prisma);
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);

    const logout = await request(t.app)
      .post('/api/auth/logout')
      .set(csrf)
      .set('cookie', session.cookie);
    expect(logout.status).toBe(204);

    const refresh = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', session.cookie);
    expect(refresh.status).toBe(401);

    const anonymous = await request(t.app).post('/api/auth/logout').set(csrf);
    expect(anonymous.status).toBe(204);
  });
});

describe('profile', () => {
  it('returns and updates the current user', async () => {
    const user = await createUser(t.prisma);
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);

    const me = await request(t.app).get('/api/auth/me').set(session.auth);
    expect(dataOf(me.body, userSchema).email).toBe(user.email);

    const updated = await request(t.app)
      .patch('/api/auth/me')
      .set(session.auth)
      .send({ firstName: 'Renamed', lastName: 'Person', phone: null });
    expect(dataOf(updated.body, userSchema)).toMatchObject({ firstName: 'Renamed', phone: null });
  });

  it('rejects missing, malformed, and stale tokens', async () => {
    expect((await request(t.app).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(t.app).get('/api/auth/me').set('authorization', 'Basic abc')).status,
    ).toBe(401);
    expect(
      (await request(t.app).get('/api/auth/me').set('authorization', 'Bearer nope')).status,
    ).toBe(401);

    const user = await createUser(t.prisma);
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);
    await t.prisma.user.delete({ where: { id: user.id } });
    expect((await request(t.app).get('/api/auth/me').set(session.auth)).status).toBe(401);
  });

  it('changes the password and signs out other sessions', async () => {
    const user = await createUser(t.prisma);
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);

    const wrong = await request(t.app)
      .post('/api/auth/change-password')
      .set(session.auth)
      .send({ currentPassword: 'Nope12345', newPassword: 'Changed123' });
    expect(errorCodeOf(wrong.body)).toBe('INVALID_PASSWORD');

    const changed = await request(t.app)
      .post('/api/auth/change-password')
      .set(session.auth)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'Changed123' });
    expect(changed.status).toBe(200);

    const oldRefresh = await request(t.app)
      .post('/api/auth/refresh')
      .set(csrf)
      .set('cookie', session.cookie);
    expect(oldRefresh.status).toBe(401);
    await expect(login(t.app, user.email, 'Changed123')).resolves.toBeDefined();
  });
});

describe('password reset', () => {
  it('always reports success and emails a working reset link to real accounts', async () => {
    const user = await createUser(t.prisma);

    const unknown = await request(t.app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(200);
    expect(t.mailer.messages).toHaveLength(0);

    const known = await request(t.app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });
    expect(known.body).toEqual(unknown.body);

    const token = t.mailer.lastToken(user.email);
    const reset = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'BrandNew123' });
    expect(reset.status).toBe(200);
    await expect(login(t.app, user.email, 'BrandNew123')).resolves.toBeDefined();

    const reused = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Another123' });
    expect(errorCodeOf(reused.body)).toBe('INVALID_TOKEN');
  });

  it('rejects expired reset tokens', async () => {
    const user = await createUser(t.prisma);
    await request(t.app).post('/api/auth/forgot-password').send({ email: user.email });
    const token = t.mailer.lastToken(user.email);

    t.setNow(new Date(Date.now() + 2 * 3_600_000));
    const reset = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'BrandNew123' });
    t.setNow(null);

    expect(errorCodeOf(reset.body)).toBe('INVALID_TOKEN');
  });
});

describe('email verification', () => {
  it('verifies with the emailed token and supports resending', async () => {
    const user = await createUser(t.prisma, { emailVerified: false });
    const session = await login(t.app, user.email, DEFAULT_PASSWORD);

    const resend = await request(t.app).post('/api/auth/verify-email/resend').set(session.auth);
    expect(resend.status).toBe(200);

    const verify = await request(t.app)
      .post('/api/auth/verify-email')
      .send({ token: t.mailer.lastToken(user.email) });
    expect(dataOf(verify.body, userSchema).emailVerified).toBe(true);

    const again = await request(t.app).post('/api/auth/verify-email/resend').set(session.auth);
    expect(errorCodeOf(again.body)).toBe('ALREADY_VERIFIED');

    const invalid = await request(t.app)
      .post('/api/auth/verify-email')
      .send({ token: 'x'.repeat(43) });
    expect(errorCodeOf(invalid.body)).toBe('INVALID_TOKEN');
  });
});
