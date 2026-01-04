// ThemeProvider
// components/theme-provider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { APP_EVENTS } from "@/lib/app-events";

type ColorLike = { hex?: string | null };

export type ThemeInput = {
  bg?: string | ColorLike | null;
  text?: string | ColorLike | null;
};

export type Theme = { bg: string; text: string };

export type ThemeApplyOptions = {
  animate?: boolean;
  force?: boolean; // ignore app-scrolling gating
  durationMs?: number;
};

type ThemeContextValue = {
  theme: Theme; // locked/base theme
  previewTheme: (t: ThemeInput | null | undefined, opts?: ThemeApplyOptions) => void;
  clearPreview: (opts?: ThemeApplyOptions) => void;
  lockTheme: (t: ThemeInput | null | undefined, opts?: ThemeApplyOptions) => void;
  resetTheme: (opts?: ThemeApplyOptions) => void;
};

const DEFAULT_THEME: Theme = { bg: "#ffffff", text: "#000000" };
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColor(value: string | ColorLike | null | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.hex === "string") return value.hex || undefined;
  return undefined;
}

function normalizeTheme(input: ThemeInput | null | undefined, fallback: Theme): Theme {
  const bg = resolveColor(input?.bg) ?? fallback.bg;
  const text = resolveColor(input?.text) ?? fallback.text;
  return { bg, text };
}

function isAppScrolling(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).__appScrolling;
}

function applyThemeVars(theme: Theme, opts?: ThemeApplyOptions) {
  if (typeof document === "undefined") return;

  const animate = opts?.animate ?? true;
  const force = opts?.force ?? false;
  const durationMs = typeof opts?.durationMs === "number" ? opts.durationMs : 450;

  const allowAnim = animate && (force || !isAppScrolling());
  const dur = allowAnim ? `${durationMs}ms` : "0ms";

  const root = document.documentElement;
  const body = document.body;

  // Drive the vars your globals.css actually uses
  root.style.setProperty("--bg-color", theme.bg);
  root.style.setProperty("--text-color", theme.text);
  root.style.setProperty("--theme-dur", dur);

  // Back-compat (in case any component still uses these)
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--text", theme.text);

  // Safety: if anything bypasses vars, still correct
  try {
    root.style.backgroundColor = theme.bg;
    root.style.color = theme.text;
    body.style.backgroundColor = theme.bg;
    body.style.color = theme.text;
  } catch {
    // ignore
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Only changes on lock/reset (page enter), not on hover previews.
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  const lockedRef = useRef<Theme>(DEFAULT_THEME);
  const previewRef = useRef<Theme | null>(null);

  useEffect(() => {
    lockedRef.current = theme;
  }, [theme]);

  // Boot apply:
  // On hard reload, a page-level ThemeSetter may apply the page theme during hydration.
  // If so, do NOT overwrite it by re-applying DEFAULT_THEME here.
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    if (typeof window !== "undefined" && (window as any).__themeBootstrapped) {
      return;
    }

    applyThemeVars(lockedRef.current, { animate: false, force: true });
  }, []);

  // Optional: during scroll, force theme duration to 0ms (no repaint-y animations)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const freeze = () => {
      try {
        document.documentElement.style.setProperty("--theme-dur", "0ms");
      } catch {
        // ignore
      }
    };

    const unfreeze = () => {
      // leave at 0ms; next theme apply will set correct duration
    };

    window.addEventListener(APP_EVENTS.SCROLL_START, freeze);
    window.addEventListener(APP_EVENTS.SCROLL_END, unfreeze);

    return () => {
      window.removeEventListener(APP_EVENTS.SCROLL_START, freeze as any);
      window.removeEventListener(APP_EVENTS.SCROLL_END, unfreeze as any);
    };
  }, []);

  const previewTheme = useCallback((t: ThemeInput | null | undefined, opts?: ThemeApplyOptions) => {
    const next = normalizeTheme(t ?? null, lockedRef.current);
    previewRef.current = next;
    applyThemeVars(next, opts);
  }, []);

  const clearPreview = useCallback((opts?: ThemeApplyOptions) => {
    previewRef.current = null;
    applyThemeVars(lockedRef.current, opts);
  }, []);

  const lockTheme = useCallback((t: ThemeInput | null | undefined, opts?: ThemeApplyOptions) => {
    const next = normalizeTheme(t ?? null, DEFAULT_THEME);
    previewRef.current = null;
    lockedRef.current = next;

    // Rerender only on lock (route entry)
    setTheme(next);

    applyThemeVars(next, opts);
  }, []);

  const resetTheme = useCallback((opts?: ThemeApplyOptions) => {
    previewRef.current = null;
    lockedRef.current = DEFAULT_THEME;

    setTheme(DEFAULT_THEME);

    applyThemeVars(DEFAULT_THEME, opts);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      theme,
      previewTheme,
      clearPreview,
      lockTheme,
      resetTheme,
    };
  }, [theme, previewTheme, clearPreview, lockTheme, resetTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Actions-only hook to avoid rerenders in hover-heavy components.
 */
export function useThemeActions() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeActions must be used within <ThemeProvider>");
  return {
    previewTheme: ctx.previewTheme,
    clearPreview: ctx.clearPreview,
    lockTheme: ctx.lockTheme,
    resetTheme: ctx.resetTheme,
  } as const;
}
