import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCatalogDestinations, fetchCatalogItems, fetchCatalogPackages } from '../data/supabaseCatalog';
import { mockDestinations, mockIndividualItems, mockPackages } from '../data/mockData';
import type { Destination, IndividualItem, PackageKit } from '../types/gearbnb';

interface CatalogContextValue {
  kits: PackageKit[];
  items: IndividualItem[];
  destinations: Destination[];
}

/**
 * Starts from the mock catalog so pages render immediately with no loading state, then swaps in
 * live Supabase data once it resolves. Falls back to (and stays on) mock data if a table errors
 * or is still empty, so the site stays demoable while the RMS side seeds real inventory.
 */
const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [kits, setKits] = useState<PackageKit[]>(mockPackages);
  const [items, setItems] = useState<IndividualItem[]>(mockIndividualItems);
  const [destinations, setDestinations] = useState<Destination[]>(mockDestinations);

  useEffect(() => {
    let cancelled = false;

    fetchCatalogPackages().then((data) => {
      if (!cancelled) setKits(data);
    });
    fetchCatalogItems().then((data) => {
      if (!cancelled) setItems(data);
    });
    fetchCatalogDestinations().then((data) => {
      if (!cancelled) setDestinations(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CatalogContext.Provider value={{ kits, items, destinations }}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
