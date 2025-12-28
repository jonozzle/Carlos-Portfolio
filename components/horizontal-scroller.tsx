// components/horizontal-scroller.tsx
"use client";

import type React from "react";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { saveScrollForPath, getCurrentScrollY } from "@/lib/scroll-state";
import { APP_EVENTS } from "@/lib/app-events";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = { children: React.ReactNode; className?: string };

export default function HorizontalScroller({ children, className = "" }: Props) {
  const pathname = usePathname();

  const containerRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  const pathRef = useRef<string>(pathname);
  pathRef.current = pathname;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    const track = trackRef.current;
    const spacer = spacerRef.current;
    if (!container || !track || !spacer) return;

    let ctx: gsap.Context | null = null;
    let st: ScrollTrigger | null = null;

    let rafBuild = 0;
    let rafRefresh = 0;
    let ro: ResizeObserver | null = null;

    const cancel = (id: number) => {
      try {
        if (id) cancelAnimationFrame(id);
      } catch {
        // ignore
      }
    };

    const kill = () => {
      cancel(rafBuild);
      cancel(rafRefresh);
      rafBuild = 0;
      rafRefresh = 0;

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

    const measure = () => {
      gsap.set(track, { x: 0 });
      const trackWidth = track.scrollWidth || 0;
      const viewportWidth = container.getBoundingClientRect().width || window.innerWidth || 0;
      return Math.max(0, trackWidth - viewportWidth);
    };

    const build = () => {
      kill();

      ctx = gsap.context(() => {
        const amountToScroll = measure();

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
            end: () => `+=${measure()}`,
            pin: true,
            pinSpacing: false,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
          },
        });

        st = tl.scrollTrigger ?? null;

        tl.to(
          track,
          {
            x: () => -measure(),
            ease: "none",
            autoRound: false,
            force3D: true,
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
              x: () => (1 - speed) * measure(),
              ease: "none",
              autoRound: false,
              force3D: true,
            },
            0
          );
        });
      }, container);

      rafRefresh = requestAnimationFrame(() => {
        rafRefresh = requestAnimationFrame(() => {
          try {
            ScrollTrigger.refresh();
          } catch {
            // ignore
          }
          try {
            window.dispatchEvent(new Event(APP_EVENTS.HS_READY));
          } catch {
            // ignore
          }
        });
      });
    };

    let queued = false;
    const queueBuild = () => {
      if (queued) return;
      queued = true;
      cancel(rafBuild);
      rafBuild = requestAnimationFrame(() => {
        rafBuild = requestAnimationFrame(() => {
          queued = false;
          build();
        });
      });
    };

    queueBuild();

    const onResize = () => queueBuild();
    window.addEventListener("resize", onResize);

    try {
      ro = new ResizeObserver(() => queueBuild());
      ro.observe(track);
      ro.observe(container);
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("resize", onResize);

      try {
        ro?.disconnect();
      } catch {
        // ignore
      }
      ro = null;

      // IMPORTANT:
      // Save scroll *before* killing the pin so we don’t overwrite home with 0 on unmount.
      try {
        const y = getCurrentScrollY();
        saveScrollForPath(pathRef.current, y);
      } catch {
        // ignore
      }

      kill();
    };
  }, []);

  return (
    <>
      <section ref={containerRef as React.MutableRefObject<HTMLElement | null>} className="relative h-screen w-full overflow-hidden">
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
