import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker built by vite-plugin-pwa. When a new version has downloaded, the
 * shopper decides when to switch, so an update never reloads the page in the middle of checkout.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      toast('A new version of Aura is ready', {
        description: 'Reload to get the latest improvements.',
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: 'Reload',
          onClick: () => {
            void updateServiceWorker(true);
          },
        },
      });
    },
  });
}
