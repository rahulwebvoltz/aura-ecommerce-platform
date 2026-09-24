import type { RazorpayCheckoutDto } from '@ecommerce/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

const payment: RazorpayCheckoutDto = {
  provider: 'RAZORPAY',
  keyId: 'rzp_test',
  providerOrderId: 'order_1',
  orderNumber: 'ORD-1',
  amount: 10_000,
  currency: 'INR',
  prefill: { name: 'Asha Rao', email: 'asha@example.com', contact: '' },
};

type Options = RazorpayOptions;

function installRazorpay(onOpen: (options: Options) => void) {
  const opened: Options[] = [];
  class FakeRazorpay {
    constructor(readonly options: Options) {}
    open(): void {
      opened.push(this.options);
      onOpen(this.options);
    }
  }
  window.Razorpay = FakeRazorpay;
  return opened;
}

async function freshModule() {
  vi.resetModules();
  return import('./razorpay');
}

afterEach(() => {
  delete window.Razorpay;
  document.head.innerHTML = '';
});

describe('Razorpay checkout', () => {
  it('resolves with the signed payment when the shopper pays', async () => {
    document.documentElement.style.setProperty('--accent', '#123456');
    const opened = installRazorpay((options) => {
      options.handler({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      });
    });
    const { payWithRazorpay } = await freshModule();

    await expect(payWithRazorpay(payment)).resolves.toEqual({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig',
    });
    expect(opened[0]).toMatchObject({
      key: 'rzp_test',
      order_id: 'order_1',
      theme: { color: '#123456' },
    });
    document.documentElement.style.removeProperty('--accent');
  });

  it('resolves null when dismissed and rejects malformed responses', async () => {
    installRazorpay((options) => {
      options.modal.ondismiss();
    });
    const { payWithRazorpay } = await freshModule();
    await expect(payWithRazorpay(payment)).resolves.toBeNull();

    const opened = installRazorpay((options) => {
      options.handler({ unexpected: true });
    });
    await expect(payWithRazorpay(payment)).rejects.toThrow('unexpected response');
    expect(opened[0]?.theme.color).toBe('#6d5ef5');
  });

  it('loads the checkout script once and reports load failures', async () => {
    const { loadRazorpay } = await freshModule();

    const pending = loadRazorpay();
    expect(loadRazorpay()).toBe(pending);
    const script = document.head.querySelector('script');
    expect(script?.src).toBe('https://checkout.razorpay.com/v1/checkout.js');
    installRazorpay(() => undefined);
    script?.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBe(window.Razorpay);

    const failing = await freshModule();
    delete window.Razorpay;
    const broken = failing.loadRazorpay();
    document.head.querySelector('script:last-of-type')?.dispatchEvent(new Event('load'));
    await expect(broken).rejects.toThrow('failed to initialise');

    const offline = await freshModule();
    const errored = offline.loadRazorpay();
    document.head.querySelector('script:last-of-type')?.dispatchEvent(new Event('error'));
    await expect(errored).rejects.toThrow('Could not load Razorpay');
  });
});
