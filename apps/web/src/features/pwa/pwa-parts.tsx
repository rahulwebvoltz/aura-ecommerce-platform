import { Download, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { useOnline } from '@/hooks/use-utils';
import { cn } from '@/lib/utils';
import { usePwaStore } from '@/stores/pwa.store';

/** Offers to install the store as an app. Renders nothing where the browser can't install it. */
export function InstallAppButton({ className }: { className?: string }) {
  const canInstall = usePwaStore((state) => state.installEvent !== null && !state.installed);
  const install = usePwaStore((state) => state.install);

  if (!canInstall) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        void install().then((accepted) => {
          if (accepted) {
            toast.success('Aura is installed. Find it with your other apps.');
          }
        });
      }}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-bg px-4 text-sm font-medium transition hover:border-fg/30',
        className,
      )}
    >
      <Download className="size-4" /> Install the app
    </button>
  );
}

/** A small notice while the connection is down. Cached pages and products keep working. */
export function OfflineBanner() {
  const online = useOnline();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-4 left-4 z-[65] flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full bg-fg px-4 py-2.5 text-sm text-bg shadow-lg"
        >
          <WifiOff className="size-4 shrink-0" />
          You’re offline. Pages you’ve already seen still work.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
