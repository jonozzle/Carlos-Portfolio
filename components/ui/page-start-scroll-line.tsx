"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
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

type Props = {
  enabled?: boolean | null;
  horizontalScrollTriggerId?: string;
  pollMs?: number;
};

export default function PageStartScrollLine({
  enabled,
  horizontalScrollTriggerId = "hs-horizontal",
  pollMs = 100,
}: Props) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
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
    const safariDesktop = isDesktopSafari();

    let st: ScrollTrigger | null = null;
    let checkId: number | null = null;
    let tweenScale: ((value: number) => gsap.core.Tween) | null = null;

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
      tweenScale = null;
    };

    const setup = () => {
      const triggerEl = triggerRef.current;
      const progressEl = progressRef.current;
      if (!triggerEl || !progressEl) return false;

      const horizontalST = ScrollTrigger.getById(horizontalScrollTriggerId) as ScrollTrigger | null;
      const containerAnim = horizontalST?.animation as gsap.core.Animation | undefined;
      if (!horizontalST || !containerAnim) return false;

      kill();

      const setScaleX = gsap.quickSetter(progressEl, "scaleX");
      tweenScale = safariDesktop
        ? gsap.quickTo(progressEl, "scaleX", {
          duration: 0.1,
          ease: "power1.out",
          overwrite: "auto",
        })
        : null;

      gsap.set(progressEl, {
        scaleX: 0,
        transformOrigin: "left center",
        force3D: true,
        backfaceVisibility: "hidden",
        willChange: "transform",
      });

      st = ScrollTrigger.create({
        trigger: triggerEl,
        containerAnimation: containerAnim,
        start: "left left",
        end: "right 20%",
        scrub: true,
        onUpdate: (self) => {
          if (!safariDesktop || !tweenScale) {
            setScaleX(self.progress);
            return;
          }
          tweenScale(self.progress);
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

    trySetupLoop();

    const onHsChange = () => {
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
  }, [enabled, horizontalScrollTriggerId, isMdUp, pollMs]);

  if (!enabled || !isMdUp) return null;

  return (
    <div ref={triggerRef} className="relative h-px w-full">
      <div className="absolute inset-0 bg-current opacity-10" />
      <div
        ref={progressRef}
        className="absolute inset-0 bg-current origin-left will-change-transform transform-gpu [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
