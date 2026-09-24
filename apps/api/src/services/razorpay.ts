import { z } from 'zod';

import { hmacSha256Hex, safeEqualHex } from '../utils/crypto.js';

const API_BASE = 'https://api.razorpay.com/v1';

const orderResponseSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
});

const refundResponseSchema = z.object({ id: z.string() });

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Razorpay boundary. Swapped for a fake in tests. */
export interface RazorpayGateway {
  readonly keyId: string;
  createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder>;
  refundPayment(paymentId: string, amount: number): Promise<{ id: string }>;
  verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}

export interface RazorpayGatewayOptions {
  keyId: string;
  keySecret: string;
  webhookSecret: string | undefined;
  fetchImpl?: typeof fetch;
}

export class RazorpayRequestError extends Error {
  constructor(readonly status: number) {
    super(`Razorpay request failed with status ${String(status)}.`);
    this.name = 'RazorpayRequestError';
  }
}

export function createRazorpayGateway({
  keyId,
  keySecret,
  webhookSecret,
  fetchImpl = fetch,
}: RazorpayGatewayOptions): RazorpayGateway {
  const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

  async function post(path: string, body: unknown): Promise<unknown> {
    const response = await fetchImpl(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new RazorpayRequestError(response.status);
    }

    return response.json();
  }

  return {
    keyId,
    async createOrder({ amount, currency, receipt, notes }) {
      const body = await post('/orders', { amount, currency, receipt, notes });
      return orderResponseSchema.parse(body);
    },
    async refundPayment(paymentId, amount) {
      const body = await post(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount });
      return refundResponseSchema.parse(body);
    },
    verifyPaymentSignature({ orderId, paymentId, signature }) {
      const expected = hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
      return safeEqualHex(expected, signature);
    },
    verifyWebhookSignature(rawBody, signature) {
      if (webhookSecret === undefined) {
        return false;
      }

      return safeEqualHex(hmacSha256Hex(webhookSecret, rawBody), signature);
    },
  };
}
