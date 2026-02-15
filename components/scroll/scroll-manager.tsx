// ScrollManager
// components/scroll/scroll-manager.tsx
"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import ScrollTrigger from "gsap/ScrollTrigger";
import { saveScrollForPath, setCurrentScrollY } from "@/lib/scroll-state";
import { getSavedHomeSection, saveActiveHomeSectionNow, scrollHomeToSectionId } from "@/lib/home-section";
import { consumeNavIntent } from "@/lib/nav-intent";
import { scheduleScrollTriggerRefresh } from "@/lib/refresh-manager";
import { APP_EVENTS } from "@/lib/app-events";

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
  try {
    const st = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
    return !!(st && (st as any).animation);
  } catch {
    return false;
  }
}

export default function ScrollManager() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  // 1) Always manual scroll restoration
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }
  }, []);

  // 2) Lightweight global scrolling flag + events
  useEffect(() => {
    if (typeof window === "undefined") return;

    let t: number | null = null;
    let scrolling = false;

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
      if (scrolling) return;
      scrolling = true;
      setScrolling(true);
      emit(APP_EVENTS.SCROLL_START);
    };

    const end = () => {
      scrolling = false;
      setScrolling(false);
      emit(APP_EVENTS.SCROLL_END);
    };

    const onScroll = () => {
      start();
      if (t) window.clearTimeout(t);
      t = window.setTimeout(end, 140);
    };

    setScrolling(false);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (t) window.clearTimeout(t);
      setScrolling(false);
    };
  }, []);

  // 3) Save previous route state (HOME saves section-id; others save scrollY)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prev = lastPathRef.current;
    if (prev && prev !== pathname) {
      if (prev === "/") saveActiveHomeSectionNow();
      else saveScrollForPath(prev);
    }

    lastPathRef.current = pathname;

    // entering home: reset the “restored” flag
    if (pathname === "/") {
      (window as any).__homeHsRestored = false;
    }
  }, [pathname]);

  // 4A) Non-home pages ALWAYS start at top (clean entry)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/") return;

    const pendingKind = (window as any).__pageTransitionPending?.kind as string | undefined;
    const enteredKind =
      pendingKind ?? ((window as any).__pageTransitionLast as string | undefined) ?? "simple";

    const hasHeroOverlay = !!(window as any).__heroPending;
    const isHeroNav = enteredKind === "hero" && hasHeroOverlay;

    if (isHeroNav) {
      // Hero destination targets are measured immediately on mount.
      // Multi-frame top restoration causes a second target shift on mobile.
      setCurrentScrollY(0);
      requestAnimationFrame(() => {
        setCurrentScrollY(0);
        scheduleScrollTriggerRefresh();
      });
      return;
    }

    restoreWithFrames(
      () => setCurrentScrollY(0),
      () => scheduleScrollTriggerRefresh()
    );
  }, [pathname]);

  // 4B) Home: restore by section-id (with loader “force top” override)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/") return;

    const dispatchHomeRestored = () => {
      if ((window as any).__homeHsRestored) return;
      (window as any).__homeHsRestored = true;

      // RELEASE the CSS hold now that the section is restored
      try {
        delete (document.documentElement as any).dataset.homeHold;
      } catch {
        // ignore
      }

      try {
        window.dispatchEvent(new Event(APP_EVENTS.HOME_HS_RESTORED));
      } catch {
        // ignore
      }
    };

    const restoreHome = () => {
      // Loader played -> force top once (ignore saved section)
      const forceTopOnce = !!(window as any).__forceHomeTopOnce;
      if (forceTopOnce) (window as any).__forceHomeTopOnce = false;

      const intent = consumeNavIntent();
      const saved = getSavedHomeSection();

      // prefer explicit intent when coming back from project/page
      const intentSectionId =
        intent.kind === "project-to-home" ? (intent.homeSectionId ?? null) : null;

      const targetSectionId = forceTopOnce ? null : (intentSectionId ?? saved?.id ?? null);

      const run = () => {
        if (targetSectionId && hasHsTrigger()) {
          scrollHomeToSectionId(targetSectionId);
        } else {
          setCurrentScrollY(0);
        }
      };

      restoreWithFrames(run, () => {
        let fired = false;
        let fallbackId: number | null = null;

        const fire = () => {
          if (fired) return;
          fired = true;
          if (fallbackId) window.clearTimeout(fallbackId);
          dispatchHomeRestored();
        };

        scheduleScrollTriggerRefresh(() => fire());

        // Safety: if refresh is deferred (hero overlay busy), still release restore after a beat.
        fallbackId = window.setTimeout(fire, 1200);
      });
    };

    if (hasHsTrigger()) {
      restoreHome();
      return;
    }

    window.addEventListener(APP_EVENTS.HS_READY, restoreHome, { once: true });
    return () => {
      window.removeEventListener(APP_EVENTS.HS_READY, restoreHome as any);
    };
  }, [pathname]);

  return null;
}
