import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  CartState,
  DateRange,
  IndividualItem,
  PackageKit,
  TripDetails,
  VerificationDocs,
} from '../types/gearbnb';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const initialTripDetails: TripDetails = {
  startDate: '',
  returnDate: '',
  fulfillmentType: 'pickup',
  deliveryAddress: '',
  preferredTime: '',
};

const initialVerificationDocs: VerificationDocs = {
  fullName: '',
  phone: '',
  email: '',
  idType1: '',
  idType2: '',
  verificationVideo: '',
  proofOfBilling: '',
};

const initialCartState: CartState = {
  selectedKits: [],
  kitExtras: {},
  selectedItems: [],
  tripDetails: initialTripDetails,
  verificationDocs: initialVerificationDocs,
};

type CartAction =
  | { type: 'ADD_KIT'; kit: PackageKit }
  | { type: 'REMOVE_KIT'; kitId: string }
  | { type: 'ADD_KIT_EXTRA'; kitId: string; extraId: string }
  | { type: 'REMOVE_KIT_EXTRA'; kitId: string; extraId: string }
  | { type: 'ADD_ITEM'; item: IndividualItem }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'UPDATE_TRIP_DETAILS'; details: Partial<TripDetails> }
  | { type: 'UPDATE_VERIFICATION_DOCS'; docs: Partial<VerificationDocs> }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    // Path A: kits are added/removed as single, indivisible units — no duplicates.
    case 'ADD_KIT': {
      if (state.selectedKits.some((kit) => kit.id === action.kit.id)) {
        return state;
      }
      return { ...state, selectedKits: [...state.selectedKits, action.kit] };
    }
    case 'REMOVE_KIT': {
      const kitExtras = Object.fromEntries(
        Object.entries(state.kitExtras).filter(([kitId]) => kitId !== action.kitId),
      );
      return {
        ...state,
        selectedKits: state.selectedKits.filter((kit) => kit.id !== action.kitId),
        kitExtras,
      };
    }

    // Duration-gated add-ons for a selected Path A kit.
    case 'ADD_KIT_EXTRA': {
      const existing = state.kitExtras[action.kitId] ?? [];
      if (existing.includes(action.extraId)) return state;
      return {
        ...state,
        kitExtras: { ...state.kitExtras, [action.kitId]: [...existing, action.extraId] },
      };
    }
    case 'REMOVE_KIT_EXTRA': {
      const existing = state.kitExtras[action.kitId] ?? [];
      return {
        ...state,
        kitExtras: {
          ...state.kitExtras,
          [action.kitId]: existing.filter((id) => id !== action.extraId),
        },
      };
    }

    // Path B: individual items are added/removed independently of any kit.
    case 'ADD_ITEM': {
      if (state.selectedItems.some((item) => item.id === action.item.id)) {
        return state;
      }
      return { ...state, selectedItems: [...state.selectedItems, action.item] };
    }
    case 'REMOVE_ITEM': {
      return {
        ...state,
        selectedItems: state.selectedItems.filter((item) => item.id !== action.itemId),
      };
    }

    case 'UPDATE_TRIP_DETAILS': {
      return { ...state, tripDetails: { ...state.tripDetails, ...action.details } };
    }
    case 'UPDATE_VERIFICATION_DOCS': {
      return { ...state, verificationDocs: { ...state.verificationDocs, ...action.docs } };
    }

    case 'CLEAR_CART': {
      return initialCartState;
    }

    default:
      return state;
  }
}

/** Whole rental days between startDate and returnDate; 0 if either date is missing/invalid. */
export function calculateRentalDurationDays(tripDetails: TripDetails): number {
  const { startDate, returnDate } = tripDetails;
  if (!startDate || !returnDate) return 0;

  const start = new Date(startDate);
  const end = new Date(returnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
}

/** Total refundable security deposit, due at checkout regardless of trip duration. */
export function calculateDueToday(cart: CartState): number {
  const kitDeposits = cart.selectedKits.reduce((sum, kit) => sum + kit.depositAmount, 0);
  const itemDeposits = cart.selectedItems.reduce((sum, item) => sum + item.depositAmount, 0);
  return kitDeposits + itemDeposits;
}

/** Total one-time fee for every selected Path A kit add-on across all selected kits. */
export function calculateKitExtrasFee(cart: CartState): number {
  return cart.selectedKits.reduce((sum, kit) => {
    const selectedIds = cart.kitExtras[kit.id] ?? [];
    const kitExtrasTotal = (kit.extras ?? [])
      .filter((extra) => selectedIds.includes(extra.id))
      .reduce((extraSum, extra) => extraSum + extra.price, 0);
    return sum + kitExtrasTotal;
  }, 0);
}

/**
 * Real kits are only bookable at the 48h or 72h tier. Resolves the trip's duration to a tier
 * and returns that kit's price; defensively falls back to the 48h tier for any other duration
 * (normal flow never adds a kit before a tier is chosen).
 */
export function getKitPrice(kit: PackageKit, tripDetails: TripDetails): number {
  const durationDays = calculateRentalDurationDays(tripDetails);
  return durationDays === 3 ? kit.pricing['72h'] : kit.pricing['48h'];
}

/**
 * Real gear (RentableGear) is only bookable at the 48h or 72h tier, same as kits — resolves the
 * trip's duration to a tier and returns that item's price; defensively falls back to the 48h tier
 * for any other duration (mirrors getKitPrice).
 */
export function getItemPrice(item: IndividualItem, tripDetails: TripDetails): number {
  const durationDays = calculateRentalDurationDays(tripDetails);
  return durationDays === 3 ? item.pricing['72h'] : item.pricing['48h'];
}

/** Total rental fee owed before the trip starts: kit tier prices + extras + item tier prices. */
export function calculateDueBeforeStart(cart: CartState): number {
  const kitFees = cart.selectedKits.reduce((sum, kit) => sum + getKitPrice(kit, cart.tripDetails), 0);
  const itemFees = cart.selectedItems.reduce(
    (sum, item) => sum + getItemPrice(item, cart.tripDetails),
    0,
  );

  return kitFees + calculateKitExtrasFee(cart) + itemFees;
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * System rule: a package kit is validated as a single bundled unit against mock blackout
 * windows. `range` is null until the customer picks dates; pending real RMS integration.
 */
export function checkKitAvailability(kit: PackageKit, range: DateRange | null): boolean {
  if (!range) return true;
  return !(kit.unavailableRanges ?? []).some((blocked) => rangesOverlap(range, blocked));
}

/**
 * System rule: an individual item is validated independently of any kit against mock
 * blackout windows. `range` is null until the customer picks dates; pending real RMS integration.
 */
export function checkItemAvailability(item: IndividualItem, range: DateRange | null): boolean {
  if (!range) return true;
  return !(item.unavailableRanges ?? []).some((blocked) => rangesOverlap(range, blocked));
}

interface RentalTotals {
  rentalDurationDays: number;
  dueToday: number;
  dueBeforeStart: number;
}

interface RentalContextValue {
  cart: CartState;
  dispatch: Dispatch<CartAction>;
  totals: RentalTotals;
  addKit: (kit: PackageKit) => void;
  removeKit: (kitId: string) => void;
  addKitExtra: (kitId: string, extraId: string) => void;
  removeKitExtra: (kitId: string, extraId: string) => void;
  addItem: (item: IndividualItem) => void;
  removeItem: (itemId: string) => void;
  updateTripDetails: (details: Partial<TripDetails>) => void;
  updateVerificationDocs: (docs: Partial<VerificationDocs>) => void;
  clearCart: () => void;
}

const RentalContext = createContext<RentalContextValue | undefined>(undefined);

export function RentalProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);

  const totals = useMemo<RentalTotals>(
    () => ({
      rentalDurationDays: calculateRentalDurationDays(cart.tripDetails),
      dueToday: calculateDueToday(cart),
      dueBeforeStart: calculateDueBeforeStart(cart),
    }),
    [cart],
  );

  const value = useMemo<RentalContextValue>(
    () => ({
      cart,
      dispatch,
      totals,
      addKit: (kit) => dispatch({ type: 'ADD_KIT', kit }),
      removeKit: (kitId) => dispatch({ type: 'REMOVE_KIT', kitId }),
      addKitExtra: (kitId, extraId) => dispatch({ type: 'ADD_KIT_EXTRA', kitId, extraId }),
      removeKitExtra: (kitId, extraId) => dispatch({ type: 'REMOVE_KIT_EXTRA', kitId, extraId }),
      addItem: (item) => dispatch({ type: 'ADD_ITEM', item }),
      removeItem: (itemId) => dispatch({ type: 'REMOVE_ITEM', itemId }),
      updateTripDetails: (details) => dispatch({ type: 'UPDATE_TRIP_DETAILS', details }),
      updateVerificationDocs: (docs) => dispatch({ type: 'UPDATE_VERIFICATION_DOCS', docs }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
    }),
    [cart, totals],
  );

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

export function useRental(): RentalContextValue {
  const context = useContext(RentalContext);
  if (!context) {
    throw new Error('useRental must be used within a RentalProvider');
  }
  return context;
}
