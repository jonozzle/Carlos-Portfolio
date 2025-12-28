// components/horizontal-scroller.tsx
"use client";

import type React from "react";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { scheduleScrollTriggerRefresh } from "@/lib/refresh-manager";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = { children: React.ReactNode; className?: string };

export default function HorizontalScroller({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    const track = trackRef.current;
    const spacer = spacerRef.current;
    if (!container || !track || !spacer) return;

    let ctx: gsap.Context | null = null;
    let st: ScrollTrigger | null = null;
    let raf1 = 0;
    let raf2 = 0;

    const killPinnedTrigger = () => {
      try {
        st?.kill(true);
      } catch {
        // ignore
      }
      st = null;

      try {
        ctx?.revert();
      } catch {
        // ignore
      }
      ctx = null;

      try {
        spacer.style.height = "0px";
      } catch {
        // ignore
      }

      try {
        gsap.set(track, { clearProps: "x" });
      } catch {
        // ignore
      }
    };

    const setup = () => {
      killPinnedTrigger();

      ctx = gsap.context(() => {
        const trackWidth = track.scrollWidth;
        const windowWidth = window.innerWidth;
        const amountToScroll = trackWidth - windowWidth;

        // Not wide enough -> no pinning
        if (amountToScroll <= 0) {
          spacer.style.height = "0px";
          gsap.set(track, { x: 0 });
          return;
        }

        spacer.style.height = `${amountToScroll}px`;

        const tl = gsap.timeline({
          scrollTrigger: {
            id: "hs-horizontal",
            trigger: container,
            start: "top top",
            end: `+=${amountToScroll}`,
            pin: true,
            pinSpacing: false,
            scrub: 0,
            anticipatePin: 0,
            invalidateOnRefresh: true,
          },
        });

        st = tl.scrollTrigger ?? null;

        tl.to(
          track,
          {
            x: -amountToScroll,
            ease: "none",
            autoRound: false,
          },
          0
        );

        const parallaxItems = track.querySelectorAll<HTMLElement>("[data-speed-x]");
        parallaxItems.forEach((el) => {
          const raw = el.dataset.speedX;
          const speed = raw !== undefined ? parseFloat(raw) : 1;
          if (!Number.isFinite(speed) || speed === 1) return;

          tl.to(
            el,
            {
              x: () => (1 - speed) * amountToScroll,
              ease: "none",
            },
            0
          );
        });
      }, container);

      // IMPORTANT: never refresh immediately if the user is scrolling; queue it.
      scheduleScrollTriggerRefresh(() => {
        try {
          window.dispatchEvent(new Event("hs-ready"));
        } catch {
          // ignore
        }
      });
    };

    const onResize = () => setup();

    // Initial setup after 2 RAFs (layout settles)
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setup());
    });

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);

      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);

      killPinnedTrigger();
    };
  }, []);

  return (
    <>
      <section
        ref={containerRef as React.MutableRefObject<HTMLElement | null>}
        className="relative h-screen w-full overflow-hidden"
      >
        <div
          ref={trackRef}
          className={`hs-rail flex h-full w-max [transform:translate3d(0,0,0)] ${className}`}
        >
          {children}
        </div>
      </section>
      <div ref={spacerRef} className="w-full block" />
    </>
  );
}
