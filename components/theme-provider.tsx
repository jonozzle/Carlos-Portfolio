// components/theme-provider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ColorLike = { hex?: string | null };

export type ThemeInput = {
  bg?: string | ColorLike | null;
  text?: string | ColorLike | null;
};

type Theme = { bg: string; text: string };

type ThemeContextValue = {
  theme: Theme; // locked/base theme
  previewTheme: (t: ThemeInput | null | undefined) => void;
  clearPreview: () => void;
  lockTheme: (t: ThemeInput | null | undefined) => void;
  resetTheme: () => void;
};

const DEFAULT_THEME: Theme = { bg: "#ffffff", text: "#000000" };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColor(value: string | ColorLike | null | undefined): string | undefined {
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

function applyThemeToDOM(theme: Theme, animate: boolean) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const scrolling = !!(typeof window !== "undefined" && (window as any).__appScrolling);

  // Only animate if requested and NOT scrolling
  const dur = animate && !scrolling ? "260ms" : "0ms";
  root.style.setProperty("--theme-dur", dur);

  root.style.setProperty("--bg-color", theme.bg);
  root.style.setProperty("--text-color", theme.text);

  // If we enabled animation, drop duration back to 0 after it finishes
  if (dur !== "0ms") {
    window.setTimeout(() => {
      // don’t stomp if another theme change happened
      root.style.setProperty("--theme-dur", "0ms");
    }, 300);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Locked theme in React state (rarely changes; fine to rerender)
  const [lockedTheme, setLockedTheme] = useState<Theme>(DEFAULT_THEME);

  // Refs so preview doesn’t cause rerenders
  const lockedRef = useRef<Theme>(DEFAULT_THEME);
  const isPreviewingRef = useRef(false);

  useEffect(() => {
    lockedRef.current = lockedTheme;
    applyThemeToDOM(lockedTheme, false);
  }, [lockedTheme]);

  // If user starts scrolling while previewing, snap back to locked instantly
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScrollStart = () => {
      if (!isPreviewingRef.current) return;
      isPreviewingRef.current = false;
      applyThemeToDOM(lockedRef.current, false);
    };

    window.addEventListener("app-scroll-start", onScrollStart);
    return () => window.removeEventListener("app-scroll-start", onScrollStart);
  }, []);

  const lockTheme = useCallback((input: ThemeInput | null | undefined) => {
    const next = normalizeTheme(input);
    lockedRef.current = next;
    isPreviewingRef.current = false;
    setLockedTheme(next);
    applyThemeToDOM(next, true);
  }, []);

  const previewTheme = useCallback((input: ThemeInput | null | undefined) => {
    if (typeof window !== "undefined" && (window as any).__appScrolling) return;
    const next = normalizeTheme(input);
    isPreviewingRef.current = true;
    // preview should feel immediate; no animation spam
    applyThemeToDOM(next, false);
  }, []);

  const clearPreview = useCallback(() => {
    isPreviewingRef.current = false;
    applyThemeToDOM(lockedRef.current, true);
  }, []);

  const resetTheme = useCallback(() => {
    lockedRef.current = DEFAULT_THEME;
    isPreviewingRef.current = false;
    setLockedTheme(DEFAULT_THEME);
    applyThemeToDOM(DEFAULT_THEME, true);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: lockedTheme,
      previewTheme,
      clearPreview,
      lockTheme,
      resetTheme,
    }),
    [lockedTheme, previewTheme, clearPreview, lockTheme, resetTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
