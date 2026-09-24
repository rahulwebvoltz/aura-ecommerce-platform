import type { RazorpayCheckoutDto } from '@ecommerce/types';
import { z } from 'zod';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const successSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

export interface RazorpaySuccess {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

let loading: Promise<RazorpayConstructor> | null = null;

function readConstructor(): RazorpayConstructor | null {
  return window.Razorpay ?? null;
}

/** Loads Razorpay Standard Checkout on demand, so shoppers paying by COD never download it. */
export function loadRazorpay(): Promise<RazorpayConstructor> {
  const existing = readConstructor();
  if (existing !== null) {
    return Promise.resolve(existing);
  }

  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const loaded = readConstructor();
      if (loaded === null) {
        reject(new Error('Razorpay failed to initialise.'));
      } else {
        resolve(loaded);
      }
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load Razorpay. Check your connection and try again.'));
    };
    document.head.append(script);
  });

  return loading;
}

/**
 * Opens the Razorpay modal. Resolves with the signed payment on success and with null when the
 * shopper dismisses the modal. The signature is always verified by the API afterwards.
 */
export async function payWithRazorpay(
  payment: RazorpayCheckoutDto,
): Promise<RazorpaySuccess | null> {
  const Razorpay = await loadRazorpay();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

  return new Promise((resolve, reject) => {
    const instance = new Razorpay({
      key: payment.keyId,
      order_id: payment.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'Aura',
      description: `Order ${payment.orderNumber}`,
      prefill: payment.prefill,
      theme: { color: accent === '' ? '#6d5ef5' : accent },
      handler: (response: unknown) => {
        const parsed = successSchema.safeParse(response);
        if (parsed.success) {
          resolve({
            razorpayOrderId: parsed.data.razorpay_order_id,
            razorpayPaymentId: parsed.data.razorpay_payment_id,
            razorpaySignature: parsed.data.razorpay_signature,
          });
        } else {
          reject(new Error('Razorpay returned an unexpected response.'));
        }
      },
      modal: {
        ondismiss: () => {
          resolve(null);
        },
      },
    });
    instance.open();
  });
}
