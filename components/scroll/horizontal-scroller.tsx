// HorizontalScroller
// components/scroll/horizontal-scroller.tsx
"use client";

import type React from "react";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = { children: React.ReactNode; className?: string };

type HomeActiveSection = {
  id: string;
  type: string;
  index: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

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

    let ro: ResizeObserver | null = null;
    let raf = 0;
    let raf2 = 0;

    let readyOnce = false;

    let lastActiveId: string | null = null;

    const dispatch = (name: "hs-ready" | "hs-rebuilt") => {
      try {
        window.dispatchEvent(new Event(name));
      } catch {
        // ignore
      }
    };

    const publishActive = (next: HomeActiveSection) => {
      if (lastActiveId === next.id) return;
      lastActiveId = next.id;

      try {
        (window as any).__homeActiveSection = next;
      } catch {
        // ignore
      }

      try {
        window.dispatchEvent(new CustomEvent("home-active-section-change", { detail: next }));
      } catch {
        // ignore
      }
    };

    const computeActive = (self: ScrollTrigger, amountToScroll: number) => {
      const panels = Array.from(track.querySelectorAll<HTMLElement>("[data-section-id]"));
      if (!panels.length) return;

      const vw = window.innerWidth || 1;
      const x = self.progress * amountToScroll;
      const centerX = x + vw / 2;

      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const cx = p.offsetLeft + p.offsetWidth / 2;
        const d = Math.abs(cx - centerX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      const el = panels[bestIdx];
      const id = el.getAttribute("data-section-id") || "";
      const type = el.getAttribute("data-section-type") || "";

      if (id) publishActive({ id, type, index: bestIdx });
    };

    const killInstance = () => {
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

    const build = () => {
      killInstance();

      const trackWidth = track.scrollWidth;
      const viewportWidth = window.innerWidth;
      const amountToScroll = trackWidth - viewportWidth;

      // Not wide enough -> no pinning
      if (!Number.isFinite(amountToScroll) || amountToScroll <= 0) {
        spacer.style.height = "0px";
        gsap.set(track, { x: 0 });

        // still publish an “active section” (first panel)
        const first = track.querySelector<HTMLElement>("[data-section-id]");
        if (first) {
          const id = first.getAttribute("data-section-id") || "";
          const type = first.getAttribute("data-section-type") || "";
          if (id) publishActive({ id, type, index: 0 });
        }

        if (!readyOnce) {
          readyOnce = true;
          dispatch("hs-ready");
        } else {
          dispatch("hs-rebuilt");
        }
        return;
      }

      spacer.style.height = `${amountToScroll}px`;

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "none" } });

        tl.to(
          track,
          {
            x: -amountToScroll,
            autoRound: false,
            force3D: true,
          },
          0
        );

        const parallaxItems = track.querySelectorAll<HTMLElement>("[data-speed-x]");
        parallaxItems.forEach((el) => {
          const raw = el.dataset.speedX;
          const speed = raw != null ? parseFloat(raw) : 1;
          if (!Number.isFinite(speed) || speed === 1) return;

          tl.to(
            el,
            {
              x: () => (1 - speed) * amountToScroll,
            },
            0
          );
        });

        st = ScrollTrigger.create({
          id: "hs-horizontal",
          trigger: container,
          start: "top top",
          end: `+=${amountToScroll}`,
          pin: true,
          pinSpacing: false,
          scrub: 0,
          anticipatePin: 0,
          invalidateOnRefresh: false,
          animation: tl,
          onUpdate: (self) => computeActive(self, amountToScroll),
        });
      }, container);

      try {
        ScrollTrigger.update();
      } catch {
        // ignore
      }

      if (st) computeActive(st, amountToScroll);

      if (!readyOnce) {
        readyOnce = true;
        dispatch("hs-ready");
      } else {
        dispatch("hs-rebuilt");
      }
    };

    const scheduleBuild = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(build);
    };

    raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(build);
    });

    ro = new ResizeObserver(() => scheduleBuild());
    ro.observe(track);

    const onResize = () => scheduleBuild();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      if (raf2) cancelAnimationFrame(raf2);
      try {
        ro?.disconnect();
      } catch {
        // ignore
      }
      ro = null;
      killInstance();
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
      <div ref={spacerRef} className="block w-full" />
    </>
  );
}
