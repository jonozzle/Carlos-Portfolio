"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Describe “color-like” objects locally instead of importing from `sanity`
type ColorLike = {
  hex?: string | null;
};

export type ThemeInput = {
  bg?: string | ColorLike | null;
  text?: string | ColorLike | null;
};

type Theme = {
  bg: string;
  text: string;
};

type Mode = "default" | "preview" | "locked";

type ThemeContextValue = {
  theme: Theme; // locked/base theme (not preview)
  mode: Mode;
  previewTheme: (t: ThemeInput | null | undefined) => void;
  clearPreview: () => void;
  lockTheme: (t: ThemeInput | null | undefined) => void;
  resetTheme: () => void;
};

const DEFAULT_THEME: Theme = {
  bg: "#ffffff",
  text: "#000000",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColor(
  value: string | ColorLike | null | undefined
): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value.hex === "string") return value.hex;
  return undefined;
}

function normalizeTheme(input: ThemeInput | null | undefined): Theme {
  return {
    bg: resolveColor(input?.bg) ?? DEFAULT_THEME.bg,
    text: resolveColor(input?.text) ?? DEFAULT_THEME.text,
  };
}

function applyThemeToDOM(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bg-color", theme.bg);
  root.style.setProperty("--text-color", theme.text);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // "Locked"/base theme lives in state
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [locked, setLocked] = useState<Theme>(DEFAULT_THEME);
  const [mode, setMode] = useState<Mode>("default");

  // Whenever base theme changes, update CSS variables
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Lock: update base + locked + DOM
  const lockTheme = useCallback((input: ThemeInput | null | undefined) => {
    const next = normalizeTheme(input);
    setLocked(next);
    setTheme(next);
    setMode("locked");
  }, []);

  // Preview: ONLY update CSS vars + mode, NO React state change
  const previewTheme = useCallback((input: ThemeInput | null | undefined) => {
    const next = normalizeTheme(input);
    applyThemeToDOM(next);
    setMode("preview");
  }, []);

  // Clear preview: revert CSS vars back to locked theme
  const clearPreview = useCallback(() => {
    applyThemeToDOM(locked);
    setMode("locked");
  }, [locked]);

  // Reset: go back to default theme (state + DOM)
  const resetTheme = useCallback(() => {
    setLocked(DEFAULT_THEME);
    setTheme(DEFAULT_THEME);
    setMode("default");
  }, []);

  const value: ThemeContextValue = {
    theme,
    mode,
    previewTheme,
    clearPreview,
    lockTheme,
    resetTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
