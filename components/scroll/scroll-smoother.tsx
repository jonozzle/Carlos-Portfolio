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

export default function SmoothScroller({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

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
      smooth: 0.5,
      smoothTouch: 0.1,
      effects: true,
      normalizeScroll: true,
    });

    if (contentRef.current) {
      predecodeNextImages(contentRef.current, 10);
    }

    const refresh = () => scheduleScrollTriggerRefresh();

    // Initial refresh after layout settles
    requestAnimationFrame(() => requestAnimationFrame(refresh));

    window.addEventListener("hero-transition-done", refresh);
    window.addEventListener("hero-page-hero-show", refresh);
    window.addEventListener("images-preloaded", refresh);

    return () => {
      window.removeEventListener("hero-transition-done", refresh);
      window.removeEventListener("hero-page-hero-show", refresh);
      window.removeEventListener("images-preloaded", refresh);
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
