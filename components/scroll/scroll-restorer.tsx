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
  const max = 10;
  const tick = () => {
    i += 1;
    fn();
    if (i < max) requestAnimationFrame(tick);
    else onDone?.();
  };
  requestAnimationFrame(() => requestAnimationFrame(tick));
}

function hasHsTrigger() {
  const st = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
  return !!(st && (st as any).animation);
}

export default function ScrollRestorer() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  // Gate: DO NOT persist HOME progress until we’ve actually restored HOME once.
  const homeCanPersistRef = useRef(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }
  }, []);

  // Save previous route on pathname change
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prev = lastPathRef.current;

    if (prev && prev !== pathname) {
      // Save normal scroll for non-home routes
      saveScrollForPath(prev);

      // Save HOME HS progress only if:
      // - we were on home
      // - HS trigger exists (built)
      // - we’ve already restored home at least once in this entry
      if (prev === "/" && homeCanPersistRef.current && hasHsTrigger()) {
        saveHsProgressNow();
      }
    }

    lastPathRef.current = pathname;

    // entering home: reset gate until restore completes
    if (pathname === "/") {
      homeCanPersistRef.current = false;
    }
  }, [pathname]);

  // Persist HOME HS progress while on "/" — BUT only after home is restored.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/") return;

    let raf = 0;
    let last = 0;
    let enabled = false;

    const loop = () => {
      raf = requestAnimationFrame(loop);

      if (!enabled) return;
      if (!homeCanPersistRef.current) return;
      if (!hasHsTrigger()) return;

      const now = performance.now();
      if (now - last < 150) return;
      last = now;

      saveHsProgressNow();
    };

    const enablePersist = () => {
      enabled = true;
      homeCanPersistRef.current = true;
    };

    // Only start persisting AFTER restore announces completion.
    window.addEventListener("home-hs-restored", enablePersist, { once: true });

    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("home-hs-restored", enablePersist as any);
      if (raf) cancelAnimationFrame(raf);

      // On leaving home, if it was enabled and HS exists, save one last time.
      if (enabled && hasHsTrigger()) {
        saveHsProgressNow();
      }
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
      const p = getSavedHsProgress();

      // If we have a saved HS progress AND HS trigger exists, restore it.
      if (typeof p === "number" && hasHsTrigger()) {
        restoreWithFrames(
          () => restoreHsProgressNow(p),
          () => {
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

      // Otherwise: treat as “go to top”
      dispatchHomeRestored();
    };

    // Non-home: restore immediately
    if (pathname !== "/") {
      restoreNonHome();
      return;
    }

    // Home: wait for HS build
    const onHsReady = () => {
      if (pathname === "/") restoreHomeOnceAfterHsReady();
    };

    window.addEventListener("hs-ready", onHsReady, { once: true });

    return () => {
      window.removeEventListener("hs-ready", onHsReady as any);
    };
  }, [pathname]);

  return null;
}
