import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';

import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme.store';

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2', className)}
      aria-label="Aura home"
    >
      <motion.span
        whileHover={{ rotate: -8, scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[oklch(68%_0.17_285)] to-[oklch(45%_0.22_285)] text-white shadow-[0_8px_24px_-8px_oklch(55%_0.21_285)]"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            d="M6 18 12 5l6 13M8.4 13.5h7.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </motion.span>
      <span className="text-display text-[28px] leading-none">Aura</span>
    </Link>
  );
}

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const dark = theme === 'dark';

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.88 }}
      className="relative grid size-10 place-items-center overflow-hidden rounded-full text-fg hover:bg-surface-2"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: -24, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: 24, rotate: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {dark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
