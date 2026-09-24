import { VitePWA } from 'vite-plugin-pwa';

/*
 * The PWA setup lives in plain JavaScript on purpose. vite-plugin-pwa's bundled type declarations
 * (and the workbox ones they pull in) don't compile under this repo's `skipLibCheck: false` and
 * `exactOptionalPropertyTypes`, so vite.config.ts imports this file through the small hand-written
 * pwa.config.d.ts instead. See "Where I deviated from the standards" in the README.
 */

/** @type {import('vite-plugin-pwa').VitePWAOptions} */
const options = {
  // A new version waits until the shopper accepts the "Reload" toast, so an update never
  // interrupts a checkout halfway through.
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
  manifest: {
    id: '/',
    name: 'Aura - Curated goods',
    short_name: 'Aura',
    description: 'Thoughtfully curated electronics, fashion, beauty and home goods.',
    lang: 'en-IN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#faf9f5',
    background_color: '#faf9f5',
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/screenshot-wide.jpg',
        sizes: '1440x900',
        type: 'image/jpeg',
        form_factor: 'wide',
        label: 'The Aura home page',
      },
      {
        src: '/screenshots/screenshot-narrow.jpg',
        sizes: '390x844',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'Aura on a phone',
      },
    ],
    shortcuts: [
      {
        name: 'Shop all products',
        url: '/products',
        icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
      },
      { name: 'Your bag', url: '/cart', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
      {
        name: 'Your orders',
        url: '/orders',
        icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
      },
    ],
  },
  workbox: {
    // The app shell: every route falls back to index.html, so the store opens offline.
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    // Only the Latin font subsets are used; the install screenshots are fetched on demand.
    globIgnores: [
      '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
      'screenshots/**',
    ],
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        // Public catalogue reads. Anything tied to a shopper (cart, orders, wishlist, account,
        // review eligibility) is never cached, so nothing personal outlives a sign-out.
        urlPattern: ({ url, request }) =>
          request.method === 'GET' &&
          /^\/api\/(products|categories|brands)(\/|$)/.test(url.pathname) &&
          !url.pathname.endsWith('/eligibility'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'aura-catalog',
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ url }) => url.hostname === 'cdn.dummyjson.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'aura-images',
          // Cross-origin images are opaque, and browsers pad each one heavily against the
          // storage quota, so keep this cache small.
          expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
};

export function pwa() {
  return VitePWA(options);
}
