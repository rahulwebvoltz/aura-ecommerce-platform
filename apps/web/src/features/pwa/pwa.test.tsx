import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePwaStore } from '@/stores/pwa.store';

import { InstallAppButton, OfflineBanner } from './pwa-parts';
import { registerServiceWorker } from './register-service-worker';

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }));

afterEach(() => {
  usePwaStore.setState({ installEvent: null, installed: false });
});

describe('install button', () => {
  it('appears only while the browser offers installing', async () => {
    const install = vi.fn(() => Promise.resolve(true));
    const { rerender } = render(
      <>
        <InstallAppButton />
        <Toaster />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Install the app' })).not.toBeInTheDocument();

    usePwaStore.setState({
      installEvent: Object.assign(new Event('beforeinstallprompt'), {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      }),
      install,
    });
    rerender(
      <>
        <InstallAppButton />
        <Toaster />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Install the app' }));
    expect(install).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Aura is installed/u)).toBeInTheDocument();
  });
});

describe('offline banner', () => {
  it('shows while the connection is down', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      onLine.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline');
  });
});

describe('service worker registration', () => {
  it('offers a reload when a new version is ready', async () => {
    const update = vi.fn(() => Promise.resolve());
    vi.mocked(registerSW).mockReturnValue(update);
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    render(<Toaster />);

    registerServiceWorker();
    act(() => {
      vi.mocked(registerSW).mock.calls[0]?.[0]?.onNeedRefresh?.();
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Reload' }));
    expect(update).toHaveBeenCalledWith(true);
  });

  it('does nothing where service workers are unsupported', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.mocked(registerSW).mockClear();
    registerServiceWorker();
    expect(registerSW).not.toHaveBeenCalled();
  });
});
