import { createContext, useContext, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

// Light mode is not production-ready: panels use hardcoded dark hex utilities
// that ignore the `light-mode` class, so selecting it yields an unreadable
// mixed UI. The theme is forced to dark until the palette is migrated to
// theme tokens; setTheme/toggleTheme are intentionally inert.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const value: ThemeContextValue = {
    theme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
