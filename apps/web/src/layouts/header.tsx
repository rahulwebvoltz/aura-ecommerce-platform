import type { CategoryDto } from '@ecommerce/types';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronDown, Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';

import { Logo, ThemeToggle } from '@/components/brand';
import { Drawer } from '@/components/ui/overlay';
import { CART_TARGET_ID } from '@/features/cart/fly-to-cart';
import { useCart } from '@/hooks/use-cart';
import { useScrolled } from '@/hooks/use-utils';
import { queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { catalogApi } from '@/services/catalog.api';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';

const PROMOS = [
  'Free shipping on orders over ₹999',
  'Use code WELCOME10 for 10% off your first order',
  'Cash on delivery available across India',
  'Easy 7-day returns',
  'Genuine brands, secure payments',
];

function AnnouncementBar() {
  return (
    <div className="relative overflow-hidden bg-fg py-2 text-[12px] font-medium text-bg">
      <div className="mask-fade-x flex">
        <div className="animate-marquee flex shrink-0 gap-12 pr-12 whitespace-nowrap">
          {[...PROMOS, ...PROMOS].map((promo, index) => (
            <span key={index} className="flex items-center gap-3">
              <span className="size-1 rounded-full bg-accent" /> {promo}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CartButton() {
  const cart = useCart();
  const setCartOpen = useUiStore((state) => state.setCartOpen);
  const pulse = useUiStore((state) => state.cartPulse);
  const controls = useAnimationControls();

  useEffect(() => {
    if (pulse > 0) {
      void controls.start({
        scale: [1, 1.35, 0.9, 1.1, 1],
        rotate: [0, -12, 10, -4, 0],
        transition: { duration: 0.6 },
      });
    }
  }, [controls, pulse]);

  return (
    <motion.button
      id={CART_TARGET_ID}
      type="button"
      animate={controls}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        setCartOpen(true);
      }}
      className="relative grid size-10 place-items-center rounded-full hover:bg-surface-2"
      aria-label={`Open bag, ${String(cart.itemCount)} items`}
    >
      <ShoppingBag className="size-[19px]" />
      <AnimatePresence>
        {cart.itemCount > 0 && (
          <motion.span
            key={cart.itemCount}
            initial={{ scale: 0, y: 4 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}
            className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg"
          >
            {cart.itemCount > 99 ? '99+' : cart.itemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function MegaMenu({
  categories,
  onNavigate,
}: {
  categories: CategoryDto[];
  onNavigate: () => void;
}) {
  const [focused, setFocused] = useState(0);
  const current = categories[focused];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="absolute top-full left-1/2 mt-3 w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[28px] border border-border bg-bg elevated"
    >
      <div className="grid grid-cols-[240px_1fr_260px]">
        <ul className="border-r border-border p-3">
          {categories.map((category, index) => (
            <li key={category.id}>
              <Link
                to={`/category/${category.slug}`}
                onClick={onNavigate}
                onMouseEnter={() => {
                  setFocused(index);
                }}
                onFocus={() => {
                  setFocused(index);
                }}
                className="relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium"
              >
                {index === focused && (
                  <motion.span
                    layoutId="mega-active"
                    className="absolute inset-0 rounded-xl bg-surface-2"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">{category.name}</span>
                <span className="relative text-xs text-muted">{category.productCount}</span>
              </Link>
            </li>
          ))}
        </ul>
        <AnimatePresence mode="wait">
          {current !== undefined && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <p className="eyebrow mb-4">{current.name}</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
                {current.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      to={`/category/${child.slug}`}
                      onClick={onNavigate}
                      className="group flex items-center gap-1 text-[15px] text-fg/80 hover:text-fg"
                    >
                      {child.name}
                      <ArrowUpRight className="size-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to={`/category/${current.slug}`}
                onClick={onNavigate}
                className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent"
              >
                Shop all {current.name} <ArrowUpRight className="size-4" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative m-3 overflow-hidden rounded-2xl bg-surface-2">
          <AnimatePresence mode="popLayout">
            {current?.image != null && (
              <motion.img
                key={current.id}
                src={current.image}
                alt=""
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 size-full object-contain p-6 mix-blend-multiply dark:mix-blend-normal"
              />
            )}
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fg/70 to-transparent p-4 text-bg">
            <p className="text-display text-2xl">{current?.name}</p>
            <p className="text-xs opacity-80">{current?.productCount} products</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const NAV = [
  { to: '/products?sort=newest', label: 'New in' },
  { to: '/products?sort=popular', label: 'Bestsellers' },
  { to: '/products?sort=price_asc&inStock=true', label: 'Deals' },
];

function MobileNav({ categories }: { categories: CategoryDto[] }) {
  const open = useUiStore((state) => state.menuOpen);
  const setOpen = useUiStore((state) => state.setMenuOpen);
  const [expanded, setExpanded] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
  };

  return (
    <Drawer open={open} onClose={close} title="Menu" side="left">
      <nav className="space-y-1 pb-8">
        <div className="flex items-center justify-between rounded-xl px-3 py-2 sm:hidden">
          <span className="text-lg font-medium">Appearance</span>
          <ThemeToggle />
        </div>
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={close}
            className="block rounded-xl px-3 py-3 text-lg font-medium hover:bg-surface-2"
          >
            {item.label}
          </Link>
        ))}
        <p className="eyebrow px-3 pt-6 pb-2">Shop by category</p>
        {categories.map((category) => (
          <div key={category.id}>
            <button
              type="button"
              onClick={() => {
                setExpanded(expanded === category.id ? null : category.id);
              }}
              aria-expanded={expanded === category.id}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-lg font-medium hover:bg-surface-2"
            >
              {category.name}
              <motion.span animate={{ rotate: expanded === category.id ? 180 : 0 }}>
                <ChevronDown className="size-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {expanded === category.id && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pl-4"
                >
                  {[category, ...category.children].map((child) => (
                    <li key={child.id}>
                      <Link
                        to={`/category/${child.slug}`}
                        onClick={close}
                        className="block px-3 py-2 text-muted hover:text-fg"
                      >
                        {child.id === category.id ? `All ${category.name}` : child.name}
                      </Link>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        ))}
      </nav>
    </Drawer>
  );
}

export function Header() {
  const scrolled = useScrolled(24);
  const user = useAuthStore((state) => state.user);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);
  const setMenuOpen = useUiStore((state) => state.setMenuOpen);
  const [megaOpen, setMegaOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: catalogApi.categories });

  return (
    <>
      <AnnouncementBar />
      <header
        className={cn(
          'sticky top-0 z-30 transition-[background-color,box-shadow,border-color] duration-300',
          scrolled
            ? 'glass border-b border-border/70 shadow-[0_10px_30px_-20px_rgb(0_0_0/0.25)]'
            : 'border-b border-transparent bg-bg',
        )}
      >
        <div
          className={cn(
            'container-page flex items-center gap-2 transition-[height] duration-300 sm:gap-4',
            scrolled ? 'h-16' : 'h-20',
          )}
        >
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full hover:bg-surface-2 lg:hidden"
            onClick={() => {
              setMenuOpen(true);
            }}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Logo />

          <nav
            className="relative mx-auto hidden items-center gap-1 lg:flex"
            onMouseLeave={() => {
              setHovered(null);
              setMegaOpen(false);
            }}
          >
            <button
              type="button"
              onMouseEnter={() => {
                setHovered('shop');
                setMegaOpen(true);
              }}
              onClick={() => {
                setMegaOpen((value) => !value);
              }}
              aria-expanded={megaOpen}
              className="relative flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium"
            >
              {hovered === 'shop' && (
                <motion.span
                  layoutId="nav-hover"
                  className="absolute inset-0 rounded-full bg-surface-2"
                />
              )}
              <span className="relative">Shop</span>
              <motion.span className="relative" animate={{ rotate: megaOpen ? 180 : 0 }}>
                <ChevronDown className="size-3.5" />
              </motion.span>
            </button>
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                onMouseEnter={() => {
                  setHovered(item.label);
                  setMegaOpen(false);
                }}
                className="relative rounded-full px-4 py-2 text-sm font-medium"
              >
                {hovered === item.label && (
                  <motion.span
                    layoutId="nav-hover"
                    className="absolute inset-0 rounded-full bg-surface-2"
                  />
                )}
                <span className="relative">{item.label}</span>
              </NavLink>
            ))}
            <AnimatePresence>
              {megaOpen && categories.data !== undefined && (
                <MegaMenu
                  categories={categories.data}
                  onNavigate={() => {
                    setMegaOpen(false);
                  }}
                />
              )}
            </AnimatePresence>
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1 lg:ml-0">
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
              }}
              className="group hidden h-10 items-center gap-3 rounded-full border border-border bg-surface pr-2 pl-4 text-sm text-muted transition hover:border-fg/25 md:flex"
            >
              <Search className="size-4" />
              <span className="pr-6">Search</span>
              <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
              }}
              className="grid size-10 place-items-center rounded-full hover:bg-surface-2 md:hidden"
              aria-label="Search"
            >
              <Search className="size-[19px]" />
            </button>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Link
              to="/wishlist"
              className="hidden size-10 place-items-center rounded-full hover:bg-surface-2 sm:grid"
              aria-label="Wishlist"
            >
              <Heart className="size-[19px]" />
            </Link>
            <Link
              to={user === null ? '/login' : '/account'}
              className="grid size-10 place-items-center rounded-full hover:bg-surface-2"
              aria-label={user === null ? 'Sign in' : 'Your account'}
            >
              {user === null ? (
                <User className="size-[19px]" />
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-accent to-[oklch(60%_0.2_330)] text-xs font-bold text-white">
                  {user.firstName.charAt(0)}
                  {user.lastName.charAt(0)}
                </span>
              )}
            </Link>
            <CartButton />
          </div>
        </div>
      </header>
      <MobileNav categories={categories.data ?? []} />
    </>
  );
}
