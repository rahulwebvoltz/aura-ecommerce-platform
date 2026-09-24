import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Locks page scroll, closes on Escape, traps Tab focus, and restores focus on close. */
function useDialogBehaviour(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const panel = panelRef.current;

    const previouslyFocused = document.activeElement;
    const { overflow, paddingRight } = document.body.style;
    // Replace the scrollbar with padding so the page does not shift while scrolling is locked.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${String(scrollbarWidth)}px`;
    }
    const focusTimer = window.setTimeout(() => {
      panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || panel === null) {
        return;
      }
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose, panelRef]);
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-40 bg-[oklch(12%_0.01_270/0.45)] backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    />
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'left';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panelRef);
  const offset = side === 'right' ? '100%' : '-100%';

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClose={onClose} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'fixed inset-y-0 z-50 flex w-full max-w-[440px] flex-col bg-bg elevated',
              side === 'right' ? 'right-0 sm:rounded-l-[28px]' : 'left-0 sm:rounded-r-[28px]',
            )}
            initial={{ x: offset }}
            animate={{ x: 0 }}
            exit={{ x: offset }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 id={titleId} className="text-display text-3xl">
                {title}
              </h2>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="grid size-10 place-items-center rounded-full bg-surface-2"
                aria-label="Close"
              >
                <X className="size-4" />
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto px-6">{children}</div>
            {footer !== undefined && <div className="border-t border-border p-6">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  position = 'center',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  position?: 'center' | 'top';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panelRef);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClose={onClose} />
          <div
            className={cn(
              'pointer-events-none fixed inset-0 z-50 flex justify-center p-4',
              position === 'center' ? 'items-center' : 'items-start pt-[12vh]',
            )}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className={cn(
                'pointer-events-auto w-full max-w-lg overflow-hidden rounded-[28px] border border-border bg-bg elevated',
                className,
              )}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
