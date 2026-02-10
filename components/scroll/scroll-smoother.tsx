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

function isDesktopSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const isApple = /Apple/i.test(vendor);
  const isMobile = /Mobile|iP(ad|hone|od)/i.test(ua);
  return isSafari && isApple && !isMobile;
}

export default function SmoothScroller({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const safariDesktop = isDesktopSafari();

    // Prevent “catch up” snapping.
    gsap.ticker.lagSmoothing(0);

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
      smooth: safariDesktop ? 0.35 : 0.5,
      smoothTouch: safariDesktop ? 0.1 : 0.2,
      effects: !safariDesktop,
      normalizeScroll: !safariDesktop,
    });

    if (contentRef.current) {
      predecodeNextImages(contentRef.current, 10);
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
    };
  }, []);

  return (
    <div id="smooth-wrapper" ref={wrapperRef}>
      <div id="smooth-content" ref={contentRef} className="will-change-transform [transform:translate3d(0,0,0)]">
        {children}
      </div>
    </div>
  );
}
