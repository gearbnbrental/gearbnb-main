import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gearbnb-theme';

function getInitialTheme(): Theme {
  // Mirrors index.html's own pre-hydration script exactly (see its comment) — light by default,
  // dark only once the customer has explicitly chosen it via the in-app toggle. Deliberately does
  // NOT fall back to prefers-color-scheme; the two must never disagree, or the page would flash
  // from whichever this function picks to whatever the inline script already applied.
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
