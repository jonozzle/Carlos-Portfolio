// components/ui/section-scroll-line.tsx
"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  triggerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean | null;

  /**
   * Must match HorizontalScroller's ScrollTrigger id
   */
  horizontalScrollTriggerId?: string;

  /**
   * Poll interval while waiting for hs-horizontal to exist
   */
  pollMs?: number;
};

export default function SectionScrollLine({
  triggerRef,
  enabled,
  horizontalScrollTriggerId = "hs-horizontal",
  pollMs = 100,
}: Props) {
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [isMdUp, setIsMdUp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMdUp(mq.matches);
    update();

    const mqAny = mq as any;
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", update);
    else if (typeof mqAny.addListener === "function") mqAny.addListener(update);

    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", update);
      else if (typeof mqAny.removeListener === "function") mqAny.removeListener(update);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled || !isMdUp) return;

    let st: ScrollTrigger | null = null;
    let checkId: number | null = null;

    const kill = () => {
      try {
        st?.kill();
      } catch {
        // ignore
      }
      st = null;

      if (checkId !== null) {
        window.clearTimeout(checkId);
        checkId = null;
      }
    };

    const setup = () => {
      const sectionEl = triggerRef.current;
      const progressEl = progressRef.current;
      if (!sectionEl || !progressEl) return false;

      const horizontalST = ScrollTrigger.getById(horizontalScrollTriggerId) as ScrollTrigger | null;
      const containerAnim = horizontalST?.animation as gsap.core.Animation | undefined;

      // IMPORTANT: behave like your old ProjectBlock:
      // if hs-horizontal isn't ready yet, do NOT fallback. Just retry until it exists.
      if (!horizontalST || !containerAnim) return false;

      kill();

      gsap.set(progressEl, { scaleX: 0, transformOrigin: "left center" });

      st = ScrollTrigger.create({
        trigger: sectionEl,
        containerAnimation: containerAnim,
        start: "left 80%",
        end: "right 20%",
        scrub: true,
        onUpdate: (self) => {
          gsap.set(progressEl, { scaleX: self.progress });
        },
      });

      try {
        ScrollTrigger.update();
      } catch {
        // ignore
      }

      return true;
    };

    const trySetupLoop = () => {
      if (setup()) return;
      checkId = window.setTimeout(trySetupLoop, pollMs);
    };

    // Initial attempt (and retry until hs-horizontal exists)
    trySetupLoop();

    // Re-bind when HorizontalScroller rebuilds (your HS emits these)
    const onHsChange = () => {
      // Recreate with the new containerAnimation
      kill();
      trySetupLoop();
    };

    window.addEventListener("hs-ready", onHsChange);
    window.addEventListener("hs-rebuilt", onHsChange);

    return () => {
      window.removeEventListener("hs-ready", onHsChange);
      window.removeEventListener("hs-rebuilt", onHsChange);
      kill();
    };
  }, [enabled, triggerRef, horizontalScrollTriggerId, pollMs, isMdUp]);

  if (!enabled || !isMdUp) return null;

  // identical markup/classes as before
  return (
    <div className="pointer-events-none absolute left-0 right-0 bottom-10 px-2 md:px-4 will-change-transform transform-gpu">
      <div className="relative h-px w-full">
        <div className="absolute inset-0 bg-current opacity-10" />
        <div
          ref={progressRef}
          className="absolute inset-0 bg-current origin-left will-change-transform transform-gpu"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </div>
  );
}
