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
import { hasRecentPointerMove } from "@/lib/hover-lock";

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

function isHoverLocked(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).__hoverLocked;
}

function isScrollLocked(): boolean {
  if (typeof window === "undefined") return false;
  return (window as any).__appScrollLockCount > 0;
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

  root.style.setProperty("--bg-color", theme.bg);
  root.style.setProperty("--text-color", theme.text);
  root.style.setProperty("--theme-dur", dur);

  // Back-compat
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--text", theme.text);

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
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  const lockedRef = useRef<Theme>(DEFAULT_THEME);
  const previewRef = useRef<Theme | null>(null);

  useEffect(() => {
    lockedRef.current = theme;
  }, [theme]);

  // Boot apply:
  // If ThemeSetter already applied a theme on hydration, do not overwrite it here.
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    if (typeof window !== "undefined" && (window as any).__themeBootstrapped) {
      return;
    }

    applyThemeVars(lockedRef.current, { animate: false, force: true });
  }, []);

  // During scroll, freeze theme duration to avoid repaint-y animations
  useEffect(() => {
    if (typeof window === "undefined") return;

    const freeze = () => {
      try {
        document.documentElement.style.setProperty("--theme-dur", "0ms");
      } catch {
        // ignore
      }
    };

    window.addEventListener(APP_EVENTS.SCROLL_START, freeze);
    return () => {
      window.removeEventListener(APP_EVENTS.SCROLL_START, freeze as any);
    };
  }, []);

  const previewTheme = useCallback((t: ThemeInput | null | undefined, opts?: ThemeApplyOptions) => {
    // Prevent “flash” previews during transitions:
    // - if hover is locked
    // - if scroll is locked (we’re navigating)
    // - if pointer hasn’t moved recently (content sliding under stationary cursor)
    if (isHoverLocked()) return;
    if (isScrollLocked()) return;
    if (!hasRecentPointerMove()) return;

    const next = normalizeTheme(t ?? null, lockedRef.current);
    previewRef.current = next;
    applyThemeVars(next, opts);
  }, []);

  const clearPreview = useCallback((opts?: ThemeApplyOptions) => {
    if (isHoverLocked()) return;
    if (isScrollLocked()) return;

    previewRef.current = null;
    applyThemeVars(lockedRef.current, opts);
  }, []);

  const lockTheme = useCallback((t: ThemeInput | null | undefined, opts?: ThemeApplyOptions) => {
    const next = normalizeTheme(t ?? null, DEFAULT_THEME);
    previewRef.current = null;
    lockedRef.current = next;

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
