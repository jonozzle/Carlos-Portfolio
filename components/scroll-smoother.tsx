// components/scroll-smoother.tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";
import { predecodeNextImages } from "@/lib/predecode";
import { useLoader } from "@/components/loader-context";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
}

function openFoucGateSoon() {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  if (html.classList.contains("fouc-ready")) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      html.classList.add("fouc-ready");
    });
  });
}

export default function SmoothScroller({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const { loaderDone } = useLoader();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }

    // CRITICAL:
    // If we're on "/" and the loader is not done yet, do NOT open the gate here.
    // HomeLoaderCC will open it AFTER it positions #page-root offscreen.
    const homeLoaderActive = pathname === "/" && !loaderDone;
    if (!homeLoaderActive) {
      openFoucGateSoon();
    }

    // Ensure only one instance
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

    const refresh = () => {
      try {
        ScrollTrigger.refresh();
      } catch {
        // ignore
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(refresh));

    window.addEventListener("hero-transition-done", refresh);
    window.addEventListener("hero-page-hero-show", refresh);

    return () => {
      window.removeEventListener("hero-transition-done", refresh);
      window.removeEventListener("hero-page-hero-show", refresh);
      smoother.kill();
    };
  }, [pathname, loaderDone]);

  return (
    <div id="smooth-wrapper" ref={wrapperRef}>
      <div
        id="smooth-content"
        ref={contentRef}
        className="will-change-transform [transform:translate3d(0,0,0)]"
      >
        {children}
      </div>
    </div>
  );
}
