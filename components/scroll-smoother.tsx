// components/scroll-smoother.tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";
import { APP_EVENTS } from "@/lib/app-events";
import { predecodeNextImages } from "@/lib/predecode";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
}

export default function SmoothScroller({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    // This removes the tiny “snap” GSAP can introduce when it re-syncs time after motion settles.
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
      smooth: 0.9,
      smoothTouch: 0.12,
      effects: false, // IMPORTANT: prevents extra work on scroll end
      normalizeScroll: false,
      ignoreMobileResize: true,
    });

    if (contentRef.current) {
      predecodeNextImages(contentRef.current, 10);
    }

    // Only refresh on explicit layout events (not scroll end).
    const refresh = () => {
      try {
        ScrollTrigger.refresh();
      } catch {
        // ignore
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(refresh));
    window.addEventListener(APP_EVENTS.IMAGES_PRELOADED, refresh);
    window.addEventListener(APP_EVENTS.HERO_TRANSITION_DONE, refresh);
    window.addEventListener(APP_EVENTS.HERO_PAGE_HERO_SHOW, refresh);

    return () => {
      window.removeEventListener(APP_EVENTS.IMAGES_PRELOADED, refresh);
      window.removeEventListener(APP_EVENTS.HERO_TRANSITION_DONE, refresh);
      window.removeEventListener(APP_EVENTS.HERO_PAGE_HERO_SHOW, refresh);
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
