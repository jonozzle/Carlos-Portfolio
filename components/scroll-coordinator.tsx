// components/scroll-coordinator.tsx
"use client";

import { useEffect, useRef } from "react";
import { APP_EVENTS } from "@/lib/app-events";

/**
 * Goal: remove the last micro-hitch by NOT doing DOM mutations exactly on ScrollTrigger “scrollEnd”.
 * We:
 * - set scrolling=true on first scroll event
 * - clear scrolling via an idle callback after a short settle delay
 */
function requestIdle(fn: () => void, timeout = 250) {
  // @ts-ignore
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    // @ts-ignore
    return window.requestIdleCallback(fn, { timeout });
  }
  return window.setTimeout(fn, 0);
}

export default function ScrollCoordinator() {
  const scrollingRef = useRef(false);
  const endTimerRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    const start = () => {
      if (scrollingRef.current) return;
      scrollingRef.current = true;

      root.dataset.scrolling = "true";
      (window as any).__appScrolling = true;

      try {
        window.dispatchEvent(new Event(APP_EVENTS.SCROLL_START));
      } catch {
        // ignore
      }
    };

    const scheduleEnd = () => {
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);

      // settle delay (lets inertia finish)
      endTimerRef.current = window.setTimeout(() => {
        if (idleRef.current) {
          // @ts-ignore
          if (typeof window.cancelIdleCallback === "function") {
            // @ts-ignore
            window.cancelIdleCallback(idleRef.current);
          } else {
            window.clearTimeout(idleRef.current);
          }
        }

        idleRef.current = requestIdle(() => {
          idleRef.current = null;

          if (!scrollingRef.current) return;
          scrollingRef.current = false;

          // Clear scrolling state when the browser is idle (prevents the tiny end hitch)
          delete root.dataset.scrolling;
          (window as any).__appScrolling = false;

          try {
            window.dispatchEvent(new Event(APP_EVENTS.SCROLL_END));
          } catch {
            // ignore
          }
        });
      }, 140);
    };

    const onScroll = () => {
      start();
      scheduleEnd();
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);

      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
      endTimerRef.current = null;

      if (idleRef.current) {
        // @ts-ignore
        if (typeof window.cancelIdleCallback === "function") {
          // @ts-ignore
          window.cancelIdleCallback(idleRef.current);
        } else {
          window.clearTimeout(idleRef.current);
        }
      }
      idleRef.current = null;

      delete root.dataset.scrolling;
      scrollingRef.current = false;
    };
  }, []);

  return null;
}
