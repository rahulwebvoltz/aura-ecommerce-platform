import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fail, json, ok } from '@/test/utils';

import { ApiError, buildUrl, createApiClient } from './api-client';

const itemSchema = z.object({ id: z.string() });

function client(
  responses: (Response | (() => Response))[],
  options: { token?: string | null; refresh?: () => Promise<string | null> } = {},
) {
  let token = options.token ?? null;
  const fetchImpl = vi.fn<typeof fetch>(() => {
    const next = responses.shift();
    if (next === undefined) {
      throw new Error('Unexpected request.');
    }
    return Promise.resolve(typeof next === 'function' ? next() : next);
  });
  const refreshAccessToken = vi.fn(
    options.refresh ??
      (() => {
        token = 'fresh-token';
        return Promise.resolve(token);
      }),
  );
  const api = createApiClient({
    baseUrl: 'http://api.example.test/api',
    getAccessToken: () => token,
    refreshAccessToken,
    fetchImpl,
  });
  return { api, fetchImpl, refreshAccessToken };
}

function headersOf(call: Parameters<typeof fetch> | undefined): Headers {
  return new Headers(call?.[1]?.headers);
}

describe('buildUrl', () => {
  it('serialises scalars and arrays and skips empty values', () => {
    expect(
      buildUrl('http://api.example.test/api', '/products', {
        search: 'phone',
        page: 2,
        inStock: true,
        hidden: false,
        empty: '',
        missing: undefined,
        none: null,
        attr: ['color:Black', 'size:M'],
      }),
    ).toBe(
      'http://api.example.test/api/products?search=phone&page=2&inStock=true&attr=color%3ABlack&attr=size%3AM',
    );
  });
});

describe('createApiClient', () => {
  it('sends JSON with auth and CSRF headers and validates the data envelope', async () => {
    const { api, fetchImpl } = client([ok({ id: 'a' })], { token: 'abc' });

    await expect(
      api.request('/things', itemSchema, { method: 'POST', body: { name: 'x' } }),
    ).resolves.toEqual({ id: 'a' });

    const call = fetchImpl.mock.calls[0];
    const headers = headersOf(call);
    expect(headers.get('authorization')).toBe('Bearer abc');
    expect(headers.get('x-requested-with')).toBe('fetch');
    expect(headers.get('content-type')).toBe('application/json');
    expect(call?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{"name":"x"}',
    });
  });

  it('omits auth and body when there are none', async () => {
    const { api, fetchImpl } = client([ok({ id: 'a' })]);
    await api.request('/things', itemSchema);

    const headers = headersOf(fetchImpl.mock.calls[0]);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('content-type')).toBe(false);
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBeNull();
  });

  it('rejects responses that break the contract', async () => {
    const { api } = client([ok({ id: 1 }), json({ nope: true }), json('not an object')]);

    await expect(api.request('/things', itemSchema)).rejects.toMatchObject({
      code: 'CONTRACT_MISMATCH',
    });
    await expect(api.request('/things', itemSchema)).rejects.toMatchObject({
      code: 'CONTRACT_MISMATCH',
    });
    await expect(api.request('/things', itemSchema)).rejects.toMatchObject({
      code: 'CONTRACT_MISMATCH',
    });
  });

  it('surfaces server error codes, messages, and field errors', async () => {
    const { api } = client([
      fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', { email: ['Taken.'] }),
      fail(409, 'CONFLICT', 'Nope.'),
    ]);

    const error = await api.request('/things', itemSchema).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ApiError);
    if (error instanceof ApiError) {
      expect(error).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
      expect(error.fieldError('email')).toBe('Taken.');
      expect(error.fieldError('name')).toBeUndefined();
    }

    const conflict = await api.request('/things', itemSchema).catch((failure: unknown) => failure);
    expect(conflict).toMatchObject({ code: 'CONFLICT', details: {} });
  });

  it('falls back to a generic error for unreadable failures', async () => {
    const { api } = client([
      new Response('<html>oops</html>', { status: 502 }),
      new Response('', { status: 500 }),
    ]);

    await expect(api.send('/things')).rejects.toMatchObject({
      status: 502,
      code: 'UNEXPECTED_RESPONSE',
    });
    await expect(api.send('/things')).rejects.toMatchObject({
      status: 500,
      code: 'UNEXPECTED_RESPONSE',
    });
  });

  it('refreshes the access token once on 401 and retries', async () => {
    const { api, fetchImpl, refreshAccessToken } = client([
      fail(401, 'UNAUTHORIZED', 'Expired'),
      ok({ id: 'after-refresh' }),
    ]);

    await expect(api.request('/me', itemSchema)).resolves.toEqual({ id: 'after-refresh' });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(headersOf(fetchImpl.mock.calls[1]).get('authorization')).toBe('Bearer fresh-token');
  });

  it('shares one refresh between concurrent 401s', async () => {
    let release: (token: string) => void = () => undefined;
    const refresh = () =>
      new Promise<string | null>((resolve) => {
        release = resolve;
      });
    const { api, refreshAccessToken } = client(
      [fail(401, 'U', 'x'), fail(401, 'U', 'x'), ok({ id: '1' }), ok({ id: '2' })],
      { refresh },
    );

    const first = api.request('/a', itemSchema);
    const second = api.request('/b', itemSchema);
    await vi.waitFor(() => {
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    });
    release('shared');

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('gives up when the session cannot be renewed or retries are disabled', async () => {
    const { api } = client([fail(401, 'UNAUTHORIZED', 'Expired')], {
      refresh: () => Promise.resolve(null),
    });
    await expect(api.request('/me', itemSchema)).rejects.toMatchObject({ status: 401 });

    const noRetry = client([fail(401, 'UNAUTHORIZED', 'Expired')]);
    await expect(
      noRetry.api.request('/me', itemSchema, { retryOnUnauthorized: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(noRetry.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('validates whole bodies with requestRaw', async () => {
    const { api } = client([json({ data: [{ id: 'a' }], meta: { total: 1 } })]);
    const schema = z.object({ data: z.array(itemSchema), meta: z.object({ total: z.number() }) });

    await expect(api.requestRaw('/list', schema, { query: { page: 1 } })).resolves.toEqual({
      data: [{ id: 'a' }],
      meta: { total: 1 },
    });
  });

  it('uses the global fetch when no implementation is supplied', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({
      baseUrl: 'http://api.example.test/api',
      getAccessToken: () => null,
      refreshAccessToken: () => Promise.resolve(null),
    });

    await api.send('/ping', { method: 'DELETE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
