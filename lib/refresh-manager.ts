// lib/refresh-manager.ts
"use client";

import ScrollTrigger from "gsap/ScrollTrigger";

let pending = false;
let rafId = 0;
let idleId: any = null;

function requestIdle(fn: () => void, timeout = 350) {
  // @ts-ignore
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    // @ts-ignore
    return window.requestIdleCallback(fn, { timeout });
  }
  return window.setTimeout(fn, 0);
}

function cancelIdle(id: any) {
  // @ts-ignore
  if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
    // @ts-ignore
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}

/**
 * Use this instead of calling ScrollTrigger.refresh() directly.
 * - Coalesces multiple refresh requests
 * - Defers refresh until NOT scrolling (idle) if user is scrolling
 */
export function scheduleScrollTriggerRefresh() {
  if (typeof window === "undefined") return;

  pending = true;

  const isScrolling = !!(window as any).__appScrolling;

  if (isScrolling) {
    if (idleId) cancelIdle(idleId);
    idleId = requestIdle(() => {
      idleId = null;
      if (!pending) return;
      pending = false;
      try {
        ScrollTrigger.refresh();
      } catch {
        // ignore
      }
    });
    return;
  }

  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    if (!pending) return;
    pending = false;
    try {
      ScrollTrigger.refresh();
    } catch {
      // ignore
    }
  });
}
