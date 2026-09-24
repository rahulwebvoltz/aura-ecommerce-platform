import { afterEach, describe, expect, it, vi } from 'vitest';

import { type BeforeInstallPromptEvent, listenForInstallPrompt, usePwaStore } from './pwa.store';

function installPrompt(outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
}

afterEach(() => {
  usePwaStore.setState({ installEvent: null, installed: false });
});

describe('pwa store', () => {
  it('keeps the install prompt and shows it when asked', async () => {
    const stop = listenForInstallPrompt();
    const event = installPrompt('accepted');

    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(usePwaStore.getState().installEvent).toBe(event);

    await expect(usePwaStore.getState().install()).resolves.toBe(true);
    expect(event.prompt).toHaveBeenCalledOnce();
    // A prompt can only be shown once.
    expect(usePwaStore.getState().installEvent).toBeNull();
    stop();
  });

  it('reports a dismissed prompt and does nothing without one', async () => {
    const stop = listenForInstallPrompt();
    await expect(usePwaStore.getState().install()).resolves.toBe(false);

    window.dispatchEvent(installPrompt('dismissed'));
    await expect(usePwaStore.getState().install()).resolves.toBe(false);
    stop();
  });

  it('ignores look-alike events and marks the app installed', () => {
    const stop = listenForInstallPrompt();
    window.dispatchEvent(new Event('beforeinstallprompt'));
    expect(usePwaStore.getState().installEvent).toBeNull();

    window.dispatchEvent(installPrompt('accepted'));
    window.dispatchEvent(new Event('appinstalled'));
    expect(usePwaStore.getState()).toMatchObject({ installEvent: null, installed: true });

    stop();
    window.dispatchEvent(installPrompt('accepted'));
    expect(usePwaStore.getState().installEvent).toBeNull();
  });
});
