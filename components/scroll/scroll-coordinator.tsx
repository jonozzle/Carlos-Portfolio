// components/scroll-coordinator.tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * In-memory scroll flag + events.
 * NO dataset mutations, NO style changes.
 */
export default function ScrollCoordinator() {
  const scrollingRef = useRef(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const setScrolling = (v: boolean) => {
      (window as any).__appScrolling = v;
    };

    const emit = (name: "app-scroll-start" | "app-scroll-end") => {
      try {
        window.dispatchEvent(new Event(name));
      } catch {
        // ignore
      }
    };

    const start = () => {
      if (scrollingRef.current) return;
      scrollingRef.current = true;
      setScrolling(true);
      emit("app-scroll-start");
    };

    const end = () => {
      scrollingRef.current = false;
      setScrolling(false);
      emit("app-scroll-end");
    };

    const onScroll = () => {
      start();
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(end, 140);
    };

    setScrolling(false);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = null;
      scrollingRef.current = false;
      setScrolling(false);
    };
  }, []);

  return null;
}
