// components/scroll-restorer.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";
import { saveScrollForPath, getScrollForPath, setCurrentScrollY } from "@/lib/scroll-state";
import { peekNavIntent, consumeNavIntent } from "@/lib/nav-intent";
import { APP_EVENTS } from "@/lib/app-events";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  ScrollTrigger.config({ limitCallbacks: true });
}

function restoreWithFrames(fn: () => void, onDone?: () => void) {
  let i = 0;
  const max = 10;
  const tick = () => {
    i += 1;
    fn();
    if (i < max) requestAnimationFrame(tick);
    else onDone?.();
  };
  requestAnimationFrame(() => requestAnimationFrame(tick));
}

export default function ScrollRestorer() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  // Save previous route on route change
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prev = lastPathRef.current;
    if (prev && prev !== pathname) {
      // DO NOT save "/" here — HorizontalScroller saves it correctly before unpin.
      if (prev !== "/") saveScrollForPath(prev);
    }

    lastPathRef.current = pathname;
  }, [pathname]);

  // Restore on entry
  useEffect(() => {
    if (typeof window === "undefined") return;

    const dispatchHomeRestored = () => {
      try {
        window.dispatchEvent(new Event(APP_EVENTS.HOME_HS_RESTORED));
      } catch {
        // ignore
      }
    };

    if (pathname !== "/") {
      const saved = getScrollForPath(pathname);
      const target = typeof saved === "number" ? saved : 0;
      restoreWithFrames(() => setCurrentScrollY(target));
      return;
    }

    // Home: restore only when intent says project→home; else top.
    const intent = peekNavIntent();
    const targetY = intent.kind === "project-to-home" ? intent.restoreY : 0;

    let ran = false;
    const run = () => {
      if (ran) return;
      ran = true;

      restoreWithFrames(
        () => setCurrentScrollY(targetY),
        () => {
          // Don’t refresh here (this was a major source of end-of-scroll micro hitches).
          dispatchHomeRestored();
          consumeNavIntent();
        }
      );
    };

    window.addEventListener(APP_EVENTS.HS_READY, run, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(run));

    return () => window.removeEventListener(APP_EVENTS.HS_READY, run as any);
  }, [pathname]);

  return null;
}
