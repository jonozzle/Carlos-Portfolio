// components/scroll-restorer.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";
import { saveScrollForPath, getScrollForPath, setCurrentScrollY } from "@/lib/scroll-state";
import { saveHsProgressNow, getSavedHsProgress, restoreHsProgressNow } from "@/lib/hs-scroll";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
}

function restoreWithFrames(fn: () => void, onDone?: () => void) {
  let i = 0;
  const max = 10; // fewer frames = less fighting with pin/smoother
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
  const homeRestoredRef = useRef(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }
  }, []);

  // Save previous route
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prev = lastPathRef.current;
    if (prev && prev !== pathname) {
      saveScrollForPath(prev);
      if (prev === "/") saveHsProgressNow();
    }

    lastPathRef.current = pathname;

    // reset per-entry flag
    if (pathname === "/") homeRestoredRef.current = false;
  }, [pathname]);

  // While on "/", persist progress (fine)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/") return;

    let raf = 0;
    let last = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - last < 150) return;
      last = now;
      saveHsProgressNow();
    };

    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      saveHsProgressNow();
    };
  }, [pathname]);

  // Restore on entry
  useEffect(() => {
    if (typeof window === "undefined") return;

    const dispatchHomeRestored = () => {
      try {
        window.dispatchEvent(new Event("home-hs-restored"));
      } catch {
        // ignore
      }
    };

    const restoreNonHome = () => {
      const saved = getScrollForPath(pathname);
      const target = typeof saved === "number" ? saved : 0;
      restoreWithFrames(() => setCurrentScrollY(target));
    };

    const restoreHomeOnceAfterHsReady = () => {
      if (homeRestoredRef.current) return;
      homeRestoredRef.current = true;

      const p = getSavedHsProgress();
      if (typeof p === "number") {
        restoreWithFrames(
          () => restoreHsProgressNow(p),
          () => {
            // One refresh AFTER restore, not 50 refreshes during build
            try {
              ScrollTrigger.refresh();
            } catch {
              // ignore
            }
            dispatchHomeRestored();
          }
        );
        return;
      }

      dispatchHomeRestored();
    };

    // Non-home: restore immediately
    if (pathname !== "/") {
      restoreNonHome();
    }

    // Home: ONLY restore after HS has built
    const onHsReady = () => {
      if (pathname === "/") restoreHomeOnceAfterHsReady();
    };

    const onHeroEvents = () => {
      // hero transitions can change layout; refresh, but don't re-run home restore endlessly
      try {
        ScrollTrigger.refresh();
      } catch {
        // ignore
      }
    };

    window.addEventListener("hs-ready", onHsReady);
    window.addEventListener("hero-transition-done", onHeroEvents);
    window.addEventListener("hero-page-hero-show", onHeroEvents);

    return () => {
      window.removeEventListener("hs-ready", onHsReady);
      window.removeEventListener("hero-transition-done", onHeroEvents);
      window.removeEventListener("hero-page-hero-show", onHeroEvents);
    };
  }, [pathname]);

  return null;
}
