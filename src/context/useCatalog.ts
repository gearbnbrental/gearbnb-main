import { useContext } from 'react';
import { CatalogContext, type CatalogContextValue } from './CatalogContext';

/**
 * Moved out of CatalogContext.tsx into its own file — that file exporting both a component
 * (CatalogProvider) and this hook together is exactly the shape Fast Refresh can't always draw a
 * clean boundary around (see the oxlint `react/only-export-components` warning CatalogContext.tsx
 * already carried), and a new cross-file dependency edge (RentalContext.tsx calling this hook) is
 * what turned that long-standing warning into an actual "useCatalog must be used within a
 * CatalogProvider" error at runtime: a dev-server Fast Refresh cycle could re-evaluate this hook's
 * module independently of the CatalogProvider instance already mounted by App.tsx, leaving the two
 * referencing different CatalogContext object identities even though the JSX tree itself was
 * always correctly nested. Splitting the hook into its own file (which exports nothing but this
 * one function) removes that boundary ambiguity entirely — CatalogProvider/CatalogContext stay
 * exactly as they were, this is purely a relocation, not a behavior change.
 */
export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
