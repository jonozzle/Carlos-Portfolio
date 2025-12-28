// components/scroll-coordinator.tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * Sets ONLY an in-memory flag window.__appScrolling.
 * NO dataset mutations, NO style changes, nothing that can hitch at scroll end.
 */
export default function ScrollCoordinator() {
  const scrollingRef = useRef(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const start = () => {
      if (scrollingRef.current) return;
      scrollingRef.current = true;
      (window as any).__appScrolling = true;
    };

    const scheduleEnd = () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => {
        scrollingRef.current = false;
        (window as any).__appScrolling = false;
      }, 140);
    };

    const onScroll = () => {
      start();
      scheduleEnd();
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = null;
      scrollingRef.current = false;
      (window as any).__appScrolling = false;
    };
  }, []);

  return null;
}
