import { createContext } from 'react';
import type { ShopItem } from '../utils/shop';

/**
 * The shop's items when the build pre-renders the shop and each item's page (see src/prerender.tsx),
 * so their HTML has the real items in it. Null in the browser, where useShopItems fetches them.
 */
export const ShopDataContext = createContext<ShopItem[] | null>(null);
