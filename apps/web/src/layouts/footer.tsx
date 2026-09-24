import { ArrowRight, CreditCard, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Logo } from '@/components/brand';

const PERKS = [
  { icon: Truck, title: 'Free shipping', text: 'On every order over ₹999' },
  { icon: RotateCcw, title: 'Easy returns', text: '7-day hassle-free returns' },
  { icon: ShieldCheck, title: 'Secure checkout', text: 'Protected by Razorpay' },
  { icon: CreditCard, title: 'Pay your way', text: 'UPI, cards or cash on delivery' },
];

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      ['New arrivals', '/products?sort=newest'],
      ['Bestsellers', '/products?sort=popular'],
      ['Electronics', '/category/electronics'],
      ['Beauty', '/category/beauty'],
    ],
  },
  {
    title: 'Account',
    links: [
      ['Your orders', '/orders'],
      ['Wishlist', '/wishlist'],
      ['Addresses', '/account/addresses'],
      ['Security', '/account/security'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Shipping', '/products'],
      ['Returns', '/orders'],
      ['Track an order', '/orders'],
      ['Contact', '/account'],
    ],
  },
] as const;

export function Footer() {
  const [email, setEmail] = useState('');

  return (
    <footer className="mt-32 border-t border-border bg-surface">
      <div className="container-page grid gap-6 border-b border-border py-10 sm:grid-cols-2 lg:grid-cols-4">
        {PERKS.map(({ icon: Icon, title, text }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-4"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="text-sm text-muted">{text}</span>
            </span>
          </motion.div>
        ))}
      </div>

      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-12 py-16 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 max-w-sm space-y-5 sm:col-span-3 lg:col-span-1">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">
            Thoughtfully curated electronics, fashion, beauty and home goods - delivered with care
            across India.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setEmail('');
              toast.success('Thanks! You’re on the list.');
            }}
            className="flex items-center gap-2 rounded-full border border-border bg-bg p-1.5 focus-within:border-accent"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              placeholder="Your email for early access"
              aria-label="Email address"
              className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-full bg-fg text-bg transition hover:scale-105"
              aria-label="Subscribe"
            >
              <ArrowRight className="size-4" />
            </button>
          </form>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="eyebrow mb-4">{column.title}</p>
            <ul className="space-y-3 text-sm">
              {column.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-fg/75 transition hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container-page flex flex-col items-center justify-between gap-4 border-t border-border py-6 text-xs text-muted sm:flex-row">
        <p>
          © {new Date().getFullYear()} Aura Commerce. Demo storefront - product data from DummyJSON.
        </p>
        <p>Made with care in Bengaluru</p>
      </div>
    </footer>
  );
}
