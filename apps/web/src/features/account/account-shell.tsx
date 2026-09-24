import { Heart, LogOut, MapPin, Package, Shield, User } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useLogout } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

const LINKS = [
  { to: '/account', label: 'Profile', icon: User, end: true },
  { to: '/orders', label: 'Orders', icon: Package, end: false },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, end: true },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin, end: true },
  { to: '/account/security', label: 'Security', icon: Shield, end: true },
];

export function AccountShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="container-page py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
          {user !== null && (
            <div className="flex items-center gap-3 rounded-3xl bg-surface-2 p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[oklch(60%_0.2_330)] text-sm font-bold text-white">
                {user.firstName.charAt(0)}
                {user.lastName.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
          )}
          <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col" aria-label="Account">
            {LINKS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="relative shrink-0">
                {({ isActive }) => (
                  <span
                    className={cn(
                      'relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                      isActive ? 'text-bg' : 'text-fg/70 hover:text-fg',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="account-nav"
                        className="absolute inset-0 rounded-2xl bg-fg"
                        transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                      />
                    )}
                    <Icon className="relative size-4" />
                    <span className="relative">{label}</span>
                  </span>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                logout.mutate(undefined, {
                  onSettled: () => {
                    toast('You’ve been signed out');
                    void navigate('/');
                  },
                });
              }}
              className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-sale hover:bg-sale/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        </aside>

        <section className="min-w-0">
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-display text-[clamp(2.6rem,5vw,4rem)]">{title}</h1>
            {description !== undefined && <p className="mt-2 text-muted">{description}</p>}
          </motion.header>
          {children}
        </section>
      </div>
    </div>
  );
}
