// src: components/blocks/single-image-caption.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import gsap from "gsap";
import { PortableText } from "@portabletext/react";

type CaptionPosition = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

type Props = {
  value?: any[] | null;
  position?: CaptionPosition | null;
  colorHex?: string | null; // string only (e.g. "#000000")
  hoverTargetRef?: React.RefObject<HTMLElement | null>;
};

const DESKTOP_MEDIA = "(min-width: 768px)";

export default function SingleImageCaption({
  value,
  position,
  colorHex,
  hoverTargetRef,
}: Props) {
  const hasValue = Array.isArray(value) && value.length > 0;
  const pos: CaptionPosition = (position ?? "bottomRight") as CaptionPosition;

  const [isDesktop, setIsDesktop] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  const captionRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLButtonElement | null>(null);

  const resolvedColor = useMemo(() => (colorHex && colorHex.length ? colorHex : "#000000"), [colorHex]);

  const desktopPlacementClass = useMemo(() => {
    switch (pos) {
      case "topLeft":
        return "top-4 left-4";
      case "topRight":
        return "top-4 right-4";
      case "bottomLeft":
        return "bottom-4 left-4";
      case "bottomRight":
      default:
        return "bottom-4 right-4";
    }
  }, [pos]);

  // All positions collapse to bottom-right below desktop.
  const mobilePlacementClass = "bottom-4 right-4";

  const fromX = useMemo(() => {
    const isLeft = pos === "topLeft" || pos === "bottomLeft";
    return isLeft ? -18 : 18;
  }, [pos]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(DESKTOP_MEDIA);

    const apply = () => {
      setIsDesktop(mql.matches);
      setOpenMobile(false);
    };

    apply();

    const onChange = () => apply();
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  // Desktop: animate caption in/out on hover of image box
  useEffect(() => {
    if (!hasValue || !isDesktop) return;

    const target = hoverTargetRef?.current;
    const captionEl = captionRef.current;
    if (!target || !captionEl) return;

    gsap.killTweensOf(captionEl);
    gsap.set(captionEl, { autoAlpha: 0, x: fromX });

    const onEnter = () => {
      gsap.killTweensOf(captionEl);
      gsap.fromTo(
        captionEl,
        { autoAlpha: 0, x: fromX },
        { autoAlpha: 1, x: 0, duration: 0.35, ease: "power2.out" }
      );
    };

    const onLeave = () => {
      gsap.killTweensOf(captionEl);
      gsap.to(captionEl, { autoAlpha: 0, x: fromX, duration: 0.22, ease: "power2.in" });
    };

    target.addEventListener("mouseenter", onEnter, { passive: true });
    target.addEventListener("mouseleave", onLeave, { passive: true });

    return () => {
      target.removeEventListener("mouseenter", onEnter);
      target.removeEventListener("mouseleave", onLeave);
    };
  }, [hasValue, isDesktop, fromX, hoverTargetRef]);

  // Mobile: dot toggles caption; dot animates to caption top-left when open
  useEffect(() => {
    if (!hasValue || isDesktop) return;

    const captionEl = captionRef.current;
    const dotEl = dotRef.current;
    if (!captionEl || !dotEl) return;

    gsap.killTweensOf([captionEl, dotEl]);

    const moveDotToCaptionTopLeft = () => {
      const c = captionEl.getBoundingClientRect();
      const d = dotEl.getBoundingClientRect();
      const dx = c.left - d.left;
      const dy = c.top - d.top;
      gsap.to(dotEl, { x: dx, y: dy, duration: 0.28, ease: "power2.out" });
    };

    if (openMobile) {
      gsap.set(captionEl, { display: "block" });
      gsap.fromTo(
        captionEl,
        { autoAlpha: 0, x: 18 },
        { autoAlpha: 1, x: 0, duration: 0.28, ease: "power2.out" }
      );

      requestAnimationFrame(moveDotToCaptionTopLeft);

      const onResize = () => requestAnimationFrame(moveDotToCaptionTopLeft);
      window.addEventListener("resize", onResize, { passive: true });
      return () => window.removeEventListener("resize", onResize);
    }

    gsap.to(captionEl, {
      autoAlpha: 0,
      x: 18,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(captionEl, { display: "none" });
      },
    });

    gsap.to(dotEl, { x: 0, y: 0, duration: 0.22, ease: "power2.out" });
  }, [hasValue, isDesktop, openMobile]);

  if (!hasValue) return null;

  const captionBoxClass = clsx(
    "absolute z-20 pointer-events-auto",
    isDesktop ? desktopPlacementClass : mobilePlacementClass,
    "max-w-[30ch] md:max-w-[36ch]",
    "text-xs md:text-sm leading-snug tracking-tight"
  );

  const dotClass = clsx(
    "absolute z-30 pointer-events-auto",
    mobilePlacementClass,
    "h-2.5 w-2.5 md:hidden",
    "rounded-full bg-red-600"
  );

  const portableTextComponents = {
    block: {
      normal: ({ children }: any) => <p className="m-0">{children}</p>,
    },
    marks: {
      link: ({ children, value: v }: any) => {
        const href = v?.href;
        return (
          <a
            href={href}
            className="underline underline-offset-2"
            target={href?.startsWith("http") ? "_blank" : undefined}
            rel={href?.startsWith("http") ? "noreferrer" : undefined}
          >
            {children}
          </a>
        );
      },
    },
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <button
        ref={dotRef}
        type="button"
        className={dotClass}
        aria-label={openMobile ? "Hide caption" : "Show caption"}
        aria-expanded={openMobile}
        onClick={() => setOpenMobile((v) => !v)}
      />

      <div
        ref={captionRef}
        className={captionBoxClass}
        style={{
          color: resolvedColor,
          display: isDesktop ? "block" : "none",
        }}
      >
        <PortableText value={value as any} components={portableTextComponents} />
      </div>
    </div>
  );
}
