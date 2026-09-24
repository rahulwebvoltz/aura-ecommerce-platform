import { create } from 'zustand';

/** Chromium's install prompt event. It is not part of the standard DOM typings yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isInstallPrompt(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

interface PwaState {
  /** Set while the browser allows installing; null once used or when installing isn't possible. */
  installEvent: BeforeInstallPromptEvent | null;
  /** True when the store is running as an installed app. */
  installed: boolean;
  /** Opens the browser's install dialog. Resolves true when the shopper accepts. */
  install: () => Promise<boolean>;
}

export const usePwaStore = create<PwaState>()((set, get) => ({
  installEvent: null,
  installed: isStandalone(),
  install: async () => {
    const event = get().installEvent;
    if (event === null) {
      return false;
    }
    await event.prompt();
    const choice = await event.userChoice;
    // A prompt event can only be used once.
    set({ installEvent: null });
    return choice.outcome === 'accepted';
  },
}));

/**
 * Browsers fire the install prompt once, often before React has mounted, so this runs at startup.
 * The default mini-infobar is suppressed because the storefront offers its own install button.
 */
export function listenForInstallPrompt(target: Window = window): () => void {
  const onPrompt = (event: Event) => {
    if (!isInstallPrompt(event)) {
      return;
    }
    event.preventDefault();
    usePwaStore.setState({ installEvent: event });
  };
  const onInstalled = () => {
    usePwaStore.setState({ installEvent: null, installed: true });
  };

  target.addEventListener('beforeinstallprompt', onPrompt);
  target.addEventListener('appinstalled', onInstalled);
  return () => {
    target.removeEventListener('beforeinstallprompt', onPrompt);
    target.removeEventListener('appinstalled', onInstalled);
  };
}
