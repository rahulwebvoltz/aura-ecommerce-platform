/** Stand-in for vite-plugin-pwa's virtual module, which only exists inside a Vite build. */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
