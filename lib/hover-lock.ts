// hover-lock
// lib/hover-lock.ts
"use client";

export const HOVER_EVENTS = {
  UNLOCKED: "app-hover-unlocked",
} as const;

declare global {
  interface Window {
    __hoverLocked?: boolean;

    __mouseTrackInstalled?: boolean;
    __lastMouse?: { x: number; y: number } | null;
    __lastMouseAt?: number; // perf + idle gating
  }
}

export function isHoverLocked(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.__hoverLocked;
}

export function getLastMouse(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  return window.__lastMouse ?? null;
}

export function getLastMouseAt(): number | null {
  if (typeof window === "undefined") return null;
  return typeof window.__lastMouseAt === "number" ? window.__lastMouseAt : null;
}

/**
 * Prevent hover/theme changes when content scrolls underneath a stationary pointer.
 * Returns true if the pointer moved recently.
 */
export function hasRecentPointerMove(thresholdMs = 160): boolean {
  if (typeof window === "undefined") return true;
  const t = getLastMouseAt();
  if (t == null) return true; // first load: don’t block
  return Date.now() - t <= thresholdMs;
}

export function installMouseTrackerOnce() {
  if (typeof window === "undefined") return;
  if (window.__mouseTrackInstalled) return;
  window.__mouseTrackInstalled = true;

  window.__lastMouse =
    window.__lastMouse ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.__lastMouseAt = window.__lastMouseAt ?? Date.now();

  const onMove = (e: MouseEvent) => {
    window.__lastMouse = { x: e.clientX, y: e.clientY };
    window.__lastMouseAt = Date.now();
  };

  window.addEventListener("mousemove", onMove, { passive: true });
}

export function lockHover() {
  if (typeof window === "undefined") return;
  installMouseTrackerOnce();
  window.__hoverLocked = true;
}

export function unlockHover() {
  if (typeof window === "undefined") return;
  window.__hoverLocked = false;

  try {
    window.dispatchEvent(new Event(HOVER_EVENTS.UNLOCKED));
  } catch {
    // ignore
  }
}
