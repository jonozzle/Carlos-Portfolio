// components/scroll/scroll-smoother.tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";
import { predecodeNextImages } from "@/lib/predecode";
import { scheduleScrollTriggerRefresh } from "@/lib/refresh-manager";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
}

function getSafariFlags() {
  if (typeof navigator === "undefined") {
    return { isSafari: false, isDesktopSafari: false };
  }
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const isApple = /Apple/i.test(vendor);
  const isMobile = /Mobile|iP(ad|hone|od)/i.test(ua);
  return {
    isSafari: isSafari && isApple,
    isDesktopSafari: isSafari && isApple && !isMobile,
  };
}

export default function SmoothScroller({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const { isSafari, isDesktopSafari } = getSafariFlags();

    if (isDesktopSafari) {
      // On Safari desktop, allow limited catch-up so frame drops feel less stepwise.
      gsap.ticker.lagSmoothing(500, 33);
    } else {
      // Prevent “catch up” snapping.
      gsap.ticker.lagSmoothing(0);
    }

    if (isSafari) {
      ScrollTrigger.config({
        limitCallbacks: true,
        ignoreMobileResize: true,
      });
    }

    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }

    ScrollSmoother.get()?.kill();

    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current!,
      content: contentRef.current!,
      // Desktop Safari needs a tiny non-zero smoothing value so pinning stays coherent.
      // A strict 0 can cause visible vertical/horizontal correction jumps.
      // Slightly higher desktop Safari smoothing reduces visible wheel-step jitter.
      smooth: isDesktopSafari ? 0.35 : isSafari ? 0 : 0.5,
      smoothTouch: isSafari ? 0 : 0.2,
      effects: !isSafari,
      // Safari desktop benefits from normalized wheel deltas.
      normalizeScroll: isDesktopSafari ? true : !isSafari,
    });

    if (contentRef.current) {
      if (isDesktopSafari) {
        contentRef.current.style.willChange = "transform";
        contentRef.current.style.backfaceVisibility = "hidden";
        (contentRef.current.style as any).webkitBackfaceVisibility = "hidden";
      } else if (isSafari) {
        contentRef.current.style.willChange = "auto";
        contentRef.current.style.transform = "";
        contentRef.current.style.backfaceVisibility = "";
        (contentRef.current.style as any).webkitBackfaceVisibility = "";
      } else {
        contentRef.current.style.willChange = "transform";
        contentRef.current.style.transform = "translate3d(0,0,0)";
        contentRef.current.style.backfaceVisibility = "hidden";
        (contentRef.current.style as any).webkitBackfaceVisibility = "hidden";
      }
      predecodeNextImages(contentRef.current, isSafari ? 4 : 10);
    }

    // Refresh helpers:
    // - refreshNow: immediate (hero transition events)
    // - refreshIdle: run when main thread is idle (avoids hitching during scroll)
    let rafId: number | null = null;

    let idleId: number | null = null;
    let idleMode: "ric" | "timeout" | null = null;
    let idleCancel: ((id: number) => void) | null = null;

    const refreshNow = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scheduleScrollTriggerRefresh();
      });
    };

    const refreshIdle = () => {
      if (idleId != null) return;

      const run = () => {
        idleId = null;
        idleMode = null;
        idleCancel = null;
        scheduleScrollTriggerRefresh();
      };

      // Use runtime feature detection; avoid redeclaring DOM types (caused your TS errors).
      const w = window as any;

      if (typeof w.requestIdleCallback === "function") {
        idleMode = "ric";
        idleCancel = typeof w.cancelIdleCallback === "function" ? w.cancelIdleCallback.bind(window) : null;
        idleId = w.requestIdleCallback(run, { timeout: 800 }) as number;
      } else {
        idleMode = "timeout";
        idleId = window.setTimeout(run, 120);
      }
    };

    // Initial refresh after layout settles
    requestAnimationFrame(() => requestAnimationFrame(refreshNow));

    window.addEventListener("hero-transition-done", refreshNow);
    window.addEventListener("hero-page-hero-show", refreshNow);

    // If predecode dispatches this while scrolling, don’t spike refresh immediately.
    window.addEventListener("images-preloaded", refreshIdle);

    return () => {
      window.removeEventListener("hero-transition-done", refreshNow);
      window.removeEventListener("hero-page-hero-show", refreshNow);
      window.removeEventListener("images-preloaded", refreshIdle);

      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;

      if (idleId != null) {
        if (idleMode === "ric" && idleCancel) idleCancel(idleId);
        else window.clearTimeout(idleId);
      }
      idleId = null;
      idleMode = null;
      idleCancel = null;

      smoother.kill();

      if (contentRef.current) {
        contentRef.current.style.willChange = "";
        contentRef.current.style.transform = "";
        contentRef.current.style.backfaceVisibility = "";
        (contentRef.current.style as any).webkitBackfaceVisibility = "";
      }
    };
  }, []);

  return (
    <div id="smooth-wrapper" ref={wrapperRef}>
      <div id="smooth-content" ref={contentRef}>
        {children}
      </div>
    </div>
  );
}
