// src: components/blocks/single-image.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import SmoothImage from "@/components/ui/smooth-image";
import { predecodeNextImages } from "@/lib/predecode";
import { PROJECT_QUERYResult } from "@/sanity.types";
import SingleImageCaption from "@/components/blocks/single-image-caption";

type Block = NonNullable<NonNullable<PROJECT_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "single-image" }>;

function getSafeRatio(w: number | null, h: number | null) {
  if (!w || !h) return null;
  const r = w / h;
  if (!Number.isFinite(r) || r <= 0) return null;
  return Number(r.toFixed(6));
}

export default function SingleImage(props: Props) {
  const paddingSideOverridesRaw = (props as any).paddingSideOverrides;
  const {
    image,
    paddingMode,
    widthMode,
    caption,
    captionPosition,
    captionColor,
  } = props;

  const paddingSideOverrides = (Array.isArray(paddingSideOverridesRaw) ? paddingSideOverridesRaw : []).filter(
    (v: unknown) => v === "top" || v === "right" || v === "bottom" || v === "left"
  ) as Array<"top" | "right" | "bottom" | "left">;

  const sectionRef = useRef<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const imgUrl = image?.asset?.url ?? "";
  const alt =
    typeof image?.alt === "string" && image.alt.trim().length > 0
      ? image.alt
      : "Project image";

  const imgWidth = image?.asset?.width ?? null;
  const imgHeight = image?.asset?.height ?? null;

  // PADDING (preset): none | sm | md | lg | xl
  const paddingClass = useMemo(() => {
    switch (paddingMode) {
      case "none":
        return "p-0";
      case "sm":
        return "p-4 md:p-6 lg:p-8";
      case "md":
        return "p-6 md:p-8 lg:p-10";
      case "lg":
        return "p-8 md:p-24 lg:p-32";
      case "xl":
        return "p-10 md:p-12 lg:p-42";
      default:
        return "p-6 md:p-8 lg:p-10";
    }
  }, [paddingMode]);

  const paddingOverrideClass = useMemo(() => {
    const sideSet = new Set(paddingSideOverrides);
    return clsx(
      sideSet.has("top") && "!pt-0 md:!pt-0 lg:!pt-0",
      sideSet.has("right") && "!pr-0 md:!pr-0 lg:!pr-0",
      sideSet.has("bottom") && "!pb-0 md:!pb-0 lg:!pb-0",
      sideSet.has("left") && "!pl-0 md:!pl-0 lg:!pl-0"
    );
  }, [paddingSideOverrides]);

  // Fallback padding (px) before measurement
  const fallbackBasePadPx = useMemo(() => {
    switch (paddingMode) {
      case "none":
        return 0;
      case "sm":
        return 16; // p-4
      case "md":
        return 24; // p-6
      case "lg":
        return 32; // p-8
      case "xl":
        return 40; // p-10
      default:
        return 24;
    }
  }, [paddingMode]);

  const fallbackPad = useMemo(() => {
    const sideSet = new Set(paddingSideOverrides);
    const top = sideSet.has("top") ? 0 : fallbackBasePadPx;
    const right = sideSet.has("right") ? 0 : fallbackBasePadPx;
    const bottom = sideSet.has("bottom") ? 0 : fallbackBasePadPx;
    const left = sideSet.has("left") ? 0 : fallbackBasePadPx;
    return {
      x: left + right,
      y: top + bottom,
    };
  }, [fallbackBasePadPx, paddingSideOverrides]);

  const [measuredPadX, setMeasuredPadX] = useState<number>(fallbackPad.x);
  const [measuredPadY, setMeasuredPadY] = useState<number>(fallbackPad.y);

  useEffect(() => {
    setMeasuredPadX(fallbackPad.x);
    setMeasuredPadY(fallbackPad.y);
  }, [fallbackPad]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = sectionRef.current;
    if (!el) return;

    const measure = () => {
      const cs = window.getComputedStyle(el);
      const padLeft = Number.parseFloat(cs.paddingLeft || "0");
      const padRight = Number.parseFloat(cs.paddingRight || "0");
      const padTop = Number.parseFloat(cs.paddingTop || "0");
      const padBottom = Number.parseFloat(cs.paddingBottom || "0");

      if (Number.isFinite(padLeft) && Number.isFinite(padRight)) {
        setMeasuredPadX(padLeft + padRight);
      }
      if (Number.isFinite(padTop) && Number.isFinite(padBottom)) {
        setMeasuredPadY(padTop + padBottom);
      }
    };

    const onResize = () => window.requestAnimationFrame(measure);

    measure();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [paddingMode, paddingOverrideClass]);

  // WIDTH: auto | small | medium | large
  const boxClass = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "w-[calc(100vw-var(--pad-x))] md:w-[min(35vw,calc(100vw-var(--pad-x)))]";
      case "medium":
        return "w-[calc(100vw-var(--pad-x))] md:w-[min(50vw,calc(100vw-var(--pad-x)))]";
      case "large":
        return "w-[calc(100vw-var(--pad-x))] md:w-[min(65vw,calc(100vw-var(--pad-x)))]";
      case "auto":
      default:
        return "w-auto";
    }
  }, [widthMode]);

  const sizesAttr = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "(max-width: 768px) 100vw, 35vw";
      case "medium":
        return "(max-width: 768px) 100vw, 50vw";
      case "large":
        return "(max-width: 768px) 100vw, 65vw";
      case "auto":
      default:
        return "(max-width: 768px) 100vw, 100vw";
    }
  }, [widthMode]);

  const boxStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {};
    const ratio = getSafeRatio(imgWidth, imgHeight);

    if (imgWidth && imgHeight) style.aspectRatio = `${imgWidth} / ${imgHeight}`;

    if (widthMode === "auto") {
      const padXpx = `${measuredPadX}px`;
      const padYpx = `${measuredPadY}px`;

      if (ratio) {
        style.width = `min(calc(100vw - ${padXpx}), calc((100vh - ${padYpx}) * ${ratio}))`;
        style.height = `min(calc(100vh - ${padYpx}), calc((100vw - ${padXpx}) / ${ratio}))`;
      } else {
        style.width = `calc(100vw - ${padXpx})`;
        style.height = `calc(100vh - ${padYpx})`;
      }
    }

    return style;
  }, [imgWidth, imgHeight, widthMode, measuredPadX, measuredPadY]);

  const objectFit: "cover" | "contain" = widthMode === "auto" ? "contain" : "cover";

  useEffect(() => {
    if (typeof window === "undefined" || !sectionRef.current || !imgUrl) return;

    const sectionEl = sectionRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting || (entry?.intersectionRatio ?? 0) > 0) {
          predecodeNextImages(sectionEl, 1);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: "0px 50% 0px 50%", threshold: 0.01 }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, [imgUrl]);

  // Pass only a string (hex). This avoids TS conflicts with Sanity's color plugin types.
  const captionColorHex: string | undefined =
    (captionColor as any)?.hex ?? undefined;

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      className={clsx(
        "h-auto md:h-screen flex flex-none items-center justify-center relative overflow-hidden will-change-transform",
        paddingClass,
        paddingOverrideClass
      )}
      style={{ contain: "layout paint" }}
      aria-label={alt}
      data-cursor-blend="normal"
    >
      <figure className="relative inline-flex flex-col items-center max-w-[100vw]">
        <div
          ref={boxRef}
          className={clsx(
            "relative overflow-hidden max-w-[calc(100vw-var(--pad-x))] max-h-[calc(100vh-var(--pad-y))] md:max-w-[calc(100vw-var(--pad-x))] md:max-h-[calc(100vh-var(--pad-y))]",
            boxClass
          )}
          style={{
            ...boxStyle,
            ["--pad-x" as any]: `${measuredPadX}px`,
            ["--pad-y" as any]: `${measuredPadY}px`,
          }}
        >
          {imgUrl ? (
            <SmoothImage
              src={imgUrl}
              alt={alt}
              sizes={sizesAttr}
              lqipWidth={24}
              loading="lazy"
              objectFit={objectFit}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
              No image
            </div>
          )}

          <SingleImageCaption
            value={caption}
            position={captionPosition}
            colorHex={captionColorHex}
            hoverTargetRef={boxRef}
          />
        </div>
      </figure>
    </section>
  );
}
