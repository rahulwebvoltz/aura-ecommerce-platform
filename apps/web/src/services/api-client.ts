import { apiErrorBodySchema } from '@ecommerce/types';
import type { z } from 'zod';

/** A failed API call with the server's machine-readable code and field errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** First message for a field, handy for mapping server errors onto form inputs. */
  fieldError(field: string): string | undefined {
    return this.details[field]?.[0];
  }
}

export type QueryValue = string | number | boolean | readonly string[] | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal | undefined;
  /** Retry once with a refreshed access token on 401. Defaults to true. */
  retryOnUnauthorized?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
  /** Obtains a fresh access token (or null when the session cannot be renewed). */
  refreshAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '' || value === false) {
      continue;
    }
    if (typeof value === 'object') {
      for (const entry of value) {
        url.searchParams.append(key, entry);
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(status, code, message, details);
  }

  return new ApiError(status, 'UNEXPECTED_RESPONSE', 'Something went wrong. Please try again.');
}

export interface ApiClient {
  /** Calls the API and validates the `data` payload against `schema`. */
  request<T>(path: string, schema: z.ZodType<T>, options?: RequestOptions): Promise<T>;
  /** Calls the API and validates the whole body (used for paginated responses). */
  requestRaw<T>(path: string, schema: z.ZodType<T>, options?: RequestOptions): Promise<T>;
  /** Calls an endpoint that returns no content. */
  send(path: string, options?: RequestOptions): Promise<void>;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
  let refreshing: Promise<string | null> | null = null;

  /** Concurrent 401s share one refresh request, so a rotated token is never replayed. */
  function refreshOnce(): Promise<string | null> {
    refreshing ??= config.refreshAccessToken().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function call(path: string, options: RequestOptions): Promise<unknown> {
    const method = options.method ?? 'GET';
    const execute = (token: string | null) => {
      // Only state-changing calls carry the CSRF header. Leaving it off GETs keeps anonymous
      // reads "simple" CORS requests, which saves a preflight round trip on every page load.
      const headers: Record<string, string> = {
        accept: 'application/json',
        ...(method === 'GET' ? {} : { 'x-requested-with': 'fetch' }),
        ...options.headers,
      };
      if (options.body !== undefined) {
        headers['content-type'] = 'application/json';
      }
      if (token !== null) {
        headers['authorization'] = `Bearer ${token}`;
      }

      return fetchImpl(buildUrl(config.baseUrl, path, options.query), {
        method,
        headers,
        credentials: 'include',
        body: options.body === undefined ? null : JSON.stringify(options.body),
        signal: options.signal ?? null,
      });
    };

    let response = await execute(config.getAccessToken());
    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      const token = await refreshOnce();
      if (token !== null) {
        response = await execute(token);
      }
    }

    const body = await readJson(response);
    if (!response.ok) {
      throw toApiError(response.status, body);
    }

    return body;
  }

  function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError(
        0,
        'CONTRACT_MISMATCH',
        'Received an unexpected response from the server.',
      );
    }
    return parsed.data;
  }

  return {
    async request(path, schema, options = {}) {
      const body = await call(path, options);
      const envelope =
        typeof body === 'object' && body !== null && 'data' in body ? body.data : undefined;
      return parse(schema, envelope);
    },
    async requestRaw(path, schema, options = {}) {
      return parse(schema, await call(path, options));
    },
    async send(path, options = {}) {
      await call(path, options);
    },
  };
}
