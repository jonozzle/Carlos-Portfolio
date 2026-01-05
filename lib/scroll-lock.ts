// scroll-lock
// lib/scroll-lock.ts
"use client";

import ScrollTrigger from "gsap/ScrollTrigger";

type LockState = {
  wheel: (e: WheelEvent) => void;
  touch: (e: TouchEvent) => void;
  key: (e: KeyboardEvent) => void;

  // normalizeScroll bookkeeping
  hadNormalizer: boolean;

  // CSS backstops
  prevTouchAction?: string;
  prevOverscrollBehavior?: string;
};

declare global {
  interface Window {
    __appScrollLockCount?: number;
    __appScrollLockState?: LockState;
  }
}

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

function stopEvent(e: Event) {
  try {
    e.preventDefault();
  } catch {
    // ignore
  }
  try {
    // Important: prevent other listeners (including GSAP observers) later in the chain
    (e as any).stopImmediatePropagation?.();
  } catch {
    // ignore
  }
  try {
    e.stopPropagation();
  } catch {
    // ignore
  }
}

function getNormalizerInstance(): any {
  try {
    const fn = (ScrollTrigger as any).normalizeScroll;
    if (typeof fn !== "function") return null;
    // With no args, GSAP returns the current normalizer (Observer) or null/false
    return fn();
  } catch {
    return null;
  }
}

export function lockAppScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const next = (window.__appScrollLockCount ?? 0) + 1;
  window.__appScrollLockCount = next;

  if (next > 1) return;

  // Kill normalizeScroll completely so it can’t buffer deltas while locked.
  const hadNormalizer = !!getNormalizerInstance();
  if (hadNormalizer) {
    try {
      (ScrollTrigger as any).normalizeScroll(false);
    } catch {
      // ignore
    }
  }

  const wheel = (e: WheelEvent) => stopEvent(e);
  const touch = (e: TouchEvent) => stopEvent(e);
  const key = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key)) stopEvent(e);
  };

  // CSS backstops (do NOT set overflow:hidden; that can break programmatic scroll/measurements)
  const body = document.body;
  const root = document.documentElement;

  const prevTouchAction = body.style.touchAction;
  const prevOverscrollBehavior = root.style.overscrollBehavior;

  body.style.touchAction = "none";
  root.style.overscrollBehavior = "none";

  window.__appScrollLockState = {
    wheel,
    touch,
    key,
    hadNormalizer,
    prevTouchAction,
    prevOverscrollBehavior,
  };

  // Use document capture to intercept early
  document.addEventListener("wheel", wheel, { passive: false, capture: true });
  document.addEventListener("touchmove", touch, { passive: false, capture: true });
  document.addEventListener("keydown", key, { passive: false, capture: true });
}

export function unlockAppScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const curr = window.__appScrollLockCount ?? 0;
  const next = Math.max(0, curr - 1);
  window.__appScrollLockCount = next;

  if (next > 0) return;

  const st = window.__appScrollLockState;
  window.__appScrollLockState = undefined;

  if (!st) return;

  document.removeEventListener("wheel", st.wheel as any, { capture: true } as any);
  document.removeEventListener("touchmove", st.touch as any, { capture: true } as any);
  document.removeEventListener("keydown", st.key as any, { capture: true } as any);

  // Restore CSS
  try {
    document.body.style.touchAction = st.prevTouchAction ?? "";
    document.documentElement.style.overscrollBehavior = st.prevOverscrollBehavior ?? "";
  } catch {
    // ignore
  }

  // Recreate normalizeScroll fresh (prevents any queued delta “release”)
  if (st.hadNormalizer) {
    try {
      (ScrollTrigger as any).normalizeScroll(true);
    } catch {
      // ignore
    }
  }
}
