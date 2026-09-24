import { motion } from 'motion/react';
import { createPortal } from 'react-dom';

import { type CartFlight, useUiStore } from '@/stores/ui.store';

export const CART_TARGET_ID = 'cart-target';

function Flight({ flight }: { flight: CartFlight }) {
  const landFlight = useUiStore((state) => state.landFlight);
  const target = document.getElementById(CART_TARGET_ID)?.getBoundingClientRect();
  const size = Math.min(flight.from.width, flight.from.height, 180);
  const startX = flight.from.x + flight.from.width / 2 - size / 2;
  const startY = flight.from.y + flight.from.height / 2 - size / 2;
  const endX = target === undefined ? startX : target.left + target.width / 2 - size / 2;
  const endY = target === undefined ? startY - 200 : target.top + target.height / 2 - size / 2;

  return (
    <motion.img
      src={flight.image}
      alt=""
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[100] rounded-2xl object-cover shadow-2xl"
      style={{ width: size, height: size }}
      initial={{ x: startX, y: startY, scale: 1, opacity: 1, rotate: 0 }}
      animate={{
        // An arc: rise first, then dive into the cart icon.
        x: [startX, (startX + endX) / 2, endX],
        y: [startY, Math.min(startY, endY) - 140, endY],
        scale: [1, 0.7, 0.12],
        rotate: [0, -10, 12],
        opacity: [1, 1, 0.4],
      }}
      transition={{ duration: 0.85, ease: [0.5, 0, 0.2, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={() => {
        landFlight(flight.id);
      }}
    />
  );
}

/** Renders product images flying into the cart icon after "Add to cart". */
export function FlyToCart() {
  const flights = useUiStore((state) => state.flights);

  return createPortal(
    <>
      {flights.map((flight) => (
        <Flight key={flight.id} flight={flight} />
      ))}
    </>,
    document.body,
  );
}
