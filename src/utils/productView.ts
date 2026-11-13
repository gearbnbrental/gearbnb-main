import { useEffect } from 'react';

/**
 * While a product view (package, gear or add-on details) is open, marks the page so the floating
 * corner buttons (accessibility, "Need Help?", back to top) step aside on phones, where the product
 * view already fills a busy screen. Desktop keeps them. A count, not a flag: product views open
 * inside each other (an add-on from inside a package), and the buttons come back only when the
 * last one closes. The hiding itself is CSS: `.hide-in-product-view` in src/index.css.
 */
let openViews = 0;

export function useProductViewOpen(): void {
  useEffect(() => {
    openViews += 1;
    document.documentElement.dataset.productView = '';
    return () => {
      openViews -= 1;
      if (openViews === 0) delete document.documentElement.dataset.productView;
    };
  }, []);
}
