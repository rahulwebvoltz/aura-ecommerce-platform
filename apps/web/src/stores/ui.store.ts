import { create } from 'zustand';

export interface CartFlight {
  id: number;
  image: string;
  from: { x: number; y: number; width: number; height: number };
}

interface UiState {
  cartOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  flights: CartFlight[];
  /** Bumped when an item lands in the cart so the cart icon can react. */
  cartPulse: number;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  /** Launches the fly-to-cart animation from the given element. */
  launchFlight: (image: string, from: Element) => void;
  landFlight: (id: number) => void;
}

let flightId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  cartOpen: false,
  searchOpen: false,
  menuOpen: false,
  flights: [],
  cartPulse: 0,
  setCartOpen: (open) => {
    set({ cartOpen: open });
  },
  setSearchOpen: (open) => {
    set({ searchOpen: open });
  },
  setMenuOpen: (open) => {
    set({ menuOpen: open });
  },
  launchFlight: (image, from) => {
    const rect = from.getBoundingClientRect();
    flightId += 1;
    set({
      flights: [
        ...get().flights,
        {
          id: flightId,
          image,
          from: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        },
      ],
    });
  },
  landFlight: (id) => {
    set({
      flights: get().flights.filter((flight) => flight.id !== id),
      cartPulse: get().cartPulse + 1,
    });
  },
}));
