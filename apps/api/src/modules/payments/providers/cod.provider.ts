import type { PaymentProvider } from './payment-provider.js';

/** Cash on delivery: nothing to collect up front, and nothing to refund online. */
export function createCodProvider(): PaymentProvider {
  return {
    method: 'COD',
    label: 'Cash on Delivery',
    isEnabled: () => true,
    initiate: () => Promise.resolve({ provider: 'COD' }),
    refund: () => Promise.resolve(),
  };
}
