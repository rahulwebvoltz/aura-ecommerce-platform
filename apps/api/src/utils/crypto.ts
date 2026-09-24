import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** URL-safe random token suitable for refresh, reset, and verification tokens. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest used to store tokens without keeping the raw value. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');

  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly order number, e.g. ORD-260924-7KQ2MX. */
export function generateOrderNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(2, 10).replaceAll('-', '');
  const suffix = Array.from(randomBytes(6), (byte) => ORDER_ALPHABET[byte % 32]).join('');
  return `ORD-${date}-${suffix}`;
}
