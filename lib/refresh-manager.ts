// lib/refresh-manager.ts
"use client";

import ScrollTrigger from "gsap/ScrollTrigger";

let pending = false;
let rafId = 0;
let idleId: any = null;
let installed = false;

let scrolling = false;
let scrollTO: number | null = null;

const doneCallbacks: Array<() => void> = [];

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

function isUserScrolling() {
  // Prefer ScrollTrigger’s own signal if available
  try {
    // @ts-ignore
    if (typeof ScrollTrigger.isScrolling === "function") return !!ScrollTrigger.isScrolling();
  } catch {
    // ignore
  }
  // Fallback: our cheap scroll listener flag (no DOM writes)
  return scrolling || !!(typeof window !== "undefined" && (window as any).__appScrolling);
}

function installScrollObserverOnce() {
  if (installed) return;
  installed = true;
  if (typeof window === "undefined") return;

  const onScroll = () => {
    scrolling = true;
    if (scrollTO !== null) window.clearTimeout(scrollTO);
    scrollTO = window.setTimeout(() => {
      scrolling = false;
    }, 140);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
}

/**
 * Use this instead of calling ScrollTrigger.refresh() directly.
 * - Coalesces multiple refresh requests
 * - Defers refresh until NOT scrolling (idle) if user is scrolling
 * - Lets callers attach a callback that runs AFTER refresh completes
 */
export function scheduleScrollTriggerRefresh(onDone?: () => void) {
  if (typeof window === "undefined") return;

  installScrollObserverOnce();

  if (typeof onDone === "function") doneCallbacks.push(onDone);

  pending = true;

  const run = () => {
    rafId = 0;
    idleId = null;

    if (!pending) {
      while (doneCallbacks.length) doneCallbacks.shift()?.();
      return;
    }

    pending = false;

    try {
      ScrollTrigger.refresh();
    } catch {
      // ignore
    }

    while (doneCallbacks.length) doneCallbacks.shift()?.();
  };

  // If user is scrolling, wait for idle
  if (isUserScrolling()) {
    if (idleId) cancelIdle(idleId);
    idleId = requestIdle(run, 500);
    return;
  }

  // Otherwise, next frame (coalesced)
  if (rafId) return;
  rafId = requestAnimationFrame(run);
}
