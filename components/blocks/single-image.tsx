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
  const {
    image,
    paddingMode,
    widthMode,
    caption,
    captionPosition,
    captionColor,
  } = props;

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

  // Fallback padding (px) before measurement
  const fallbackPadPx = useMemo(() => {
    switch (paddingMode) {
      case "none":
        return 0;
      case "sm":
        return 16; // p-4
      case "md":
        return 24; // p-6
      case "lg":
        return 100; // p-8
      case "xl":
        return 50; // p-10
      default:
        return 24;
    }
  }, [paddingMode]);

  const [measuredPadPx, setMeasuredPadPx] = useState<number>(fallbackPadPx);

  useEffect(() => setMeasuredPadPx(fallbackPadPx), [fallbackPadPx]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = sectionRef.current;
    if (!el) return;

    const measure = () => {
      const cs = window.getComputedStyle(el);
      const px = Number.parseFloat(cs.paddingLeft || "0"); // uniform padding
      if (Number.isFinite(px)) setMeasuredPadPx(px);
    };

    const onResize = () => window.requestAnimationFrame(measure);

    measure();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [paddingMode]);

  const pad2 = measuredPadPx * 2;

  // WIDTH: auto | small | medium | large
  const boxClass = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "w-[calc(100vw - var(--pad2))] md:w-[max(0px,calc(35vw - var(--pad2)))]";
      case "medium":
        return "w-[calc(100vw - var(--pad2))] md:w-[max(0px,calc(50vw - var(--pad2)))]";
      case "large":
        return "w-[calc(100vw - var(--pad2))] md:w-[max(0px,calc(65vw - var(--pad2)))]";
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
      const pad2px = `${pad2}px`;

      if (ratio) {
        style.width = `min(calc(100vw - ${pad2px}), calc((100vh - ${pad2px}) * ${ratio}))`;
        style.height = `min(calc(100vh - ${pad2px}), calc((100vw - ${pad2px}) / ${ratio}))`;
      } else {
        style.width = `calc(100vw - ${pad2px})`;
        style.height = `calc(100vh - ${pad2px})`;
      }
    }

    return style;
  }, [imgWidth, imgHeight, widthMode, pad2]);

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
        paddingClass
      )}
      style={{ contain: "layout paint" }}
      aria-label={alt}
      data-cursor-blend="normal"
    >
      <figure className="relative inline-flex flex-col items-center max-w-[100vw]">
        <div
          ref={boxRef}
          className={clsx(
            "relative overflow-hidden max-w-[calc(100vw - var(--pad2))] max-h-[calc(100vh - var(--pad2))] md:max-w-[calc(100vw - var(--pad2))] md:max-h-[calc(100vh - var(--pad2))]",
            boxClass
          )}
          style={{
            ...boxStyle,
            ["--pad2" as any]: `${pad2}px`,
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
