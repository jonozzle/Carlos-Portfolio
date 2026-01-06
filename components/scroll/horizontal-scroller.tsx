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

    const mq = window.matchMedia("(min-width: 768px)");
    let isDesktop = mq.matches;

    const setMode = (mode: "horizontal" | "vertical") => {
      try {
        (window as any).__hsMode = mode;
      } catch {
        // ignore
      }
    };

    const dispatch = (name: "hs-ready" | "hs-rebuilt") => {
      try {
        window.dispatchEvent(new Event(name));
      } catch {
        // ignore
      }
    };

    const publishActive = (next: HomeActiveSection) => {
      if (!next?.id) return;
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

    const publishFirst = () => {
      const first = track.querySelector<HTMLElement>("[data-section-id]");
      if (!first) return;
      const id = first.getAttribute("data-section-id") || "";
      const type = first.getAttribute("data-section-type") || "";
      if (id) publishActive({ id, type, index: 0 });
    };

    const computeActiveHorizontal = (self: ScrollTrigger, amountToScroll: number) => {
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

    const computeActiveVertical = () => {
      const panels = Array.from(track.querySelectorAll<HTMLElement>("[data-section-id]"));
      if (!panels.length) return;

      const vh = window.innerHeight || 1;
      const centerY = vh / 2;

      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const r = p.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        const d = Math.abs(cy - centerY);
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

    const finalizeDispatch = () => {
      if (!readyOnce) {
        readyOnce = true;
        dispatch("hs-ready");
      } else {
        dispatch("hs-rebuilt");
      }
    };

    const buildMobile = () => {
      killInstance();
      setMode("vertical");

      // no spacer / no horizontal motion
      spacer.style.height = "0px";
      gsap.set(track, { x: 0 });

      // keep plumbing happy: id "hs-horizontal" + animation exists (so hasHsTrigger() stays true)
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "none" } }); // intentionally empty

        st = ScrollTrigger.create({
          id: "hs-horizontal",
          trigger: container,
          start: "top top",
          end: "bottom bottom",
          scrub: 0,
          pin: false,
          pinSpacing: false,
          invalidateOnRefresh: false,
          animation: tl,
          onUpdate: () => computeActiveVertical(),
        });
      }, container);

      // IMPORTANT: do NOT call publishFirst() here (it overwrites the real active section)
      computeActiveVertical();
      finalizeDispatch();
    };

    const buildDesktop = () => {
      killInstance();
      setMode("horizontal");

      const trackWidth = track.scrollWidth;
      const viewportWidth = window.innerWidth;
      const amountToScroll = trackWidth - viewportWidth;

      if (!Number.isFinite(amountToScroll) || amountToScroll <= 0) {
        spacer.style.height = "0px";
        gsap.set(track, { x: 0 });
        publishFirst();
        finalizeDispatch();
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
          onUpdate: (self) => computeActiveHorizontal(self, amountToScroll),
        });
      }, container);

      try {
        ScrollTrigger.update();
      } catch {
        // ignore
      }

      if (st) computeActiveHorizontal(st, amountToScroll);
      finalizeDispatch();
    };

    const build = () => {
      if (isDesktop) buildDesktop();
      else buildMobile();
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

    const onMqChange = () => {
      isDesktop = mq.matches;
      scheduleBuild();
    };

    const mqAny = mq as any;
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onMqChange);
    else if (typeof mqAny.addListener === "function") mqAny.addListener(onMqChange);

    // Extra safety: in vertical mode, keep active section updated while scrolling
    const onScroll = () => {
      if (!isDesktop) computeActiveVertical();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);

      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onMqChange);
      else if (typeof mqAny.removeListener === "function") mqAny.removeListener(onMqChange);

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

  // Markup stays identical; mobile vertical is handled by CSS
  return (
    <>
      <section
        ref={containerRef as React.MutableRefObject<HTMLElement | null>}
        data-hs-container
        className="relative h-screen w-full overflow-hidden"
      >
        <div
          ref={trackRef}
          data-hs-rail
          className={`hs-rail flex h-full w-max [transform:translate3d(0,0,0)] ${className}`}
        >
          {children}
        </div>
      </section>
      <div ref={spacerRef} className="block w-full" />
    </>
  );
}
