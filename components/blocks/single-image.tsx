// components/blocks/single-image.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import SmoothImage from "@/components/ui/smooth-image";
import { predecodeNextImages } from "@/lib/predecode";
import { PROJECT_QUERYResult } from "@/sanity.types";

type Block = NonNullable<NonNullable<PROJECT_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "single-image" }>;

function getSafeRatio(w: number | null, h: number | null) {
  if (!w || !h) return null;
  const r = w / h;
  if (!Number.isFinite(r) || r <= 0) return null;
  return Number(r.toFixed(6));
}

export default function SingleImage(props: Props) {
  const { image, title, paddingMode, customPadding, widthMode } = props;

  const sectionRef = useRef<HTMLElement | null>(null);

  const imgUrl = image?.asset?.url ?? "";
  const alt =
    image?.alt ??
    (typeof title === "string" && title.length > 0 ? title : "Project image");

  const imgWidth = image?.asset?.width ?? null;
  const imgHeight = image?.asset?.height ?? null;

  // PADDING: none | default | custom
  const resolvedPadding = useMemo(() => {
    switch (paddingMode) {
      case "none":
        return 0;
      case "custom":
        return typeof customPadding === "number" ? customPadding : 24;
      case "default":
      default:
        return 24;
    }
  }, [paddingMode, customPadding]);

  // WIDTH: auto | small | medium | large
  const boxClass = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "w-[35vw] max-w-[100vw]";
      case "medium":
        return "w-[50vw] max-w-[100vw]";
      case "large":
        return "w-[65vw] max-w-[100vw]";
      case "auto":
      default:
        // auto is driven by inline sizing; keep it shrinkable in flex/layout
        return "w-auto max-w-[100vw]";
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
    const paddingPx = resolvedPadding ?? 0;
    const pad2 = paddingPx * 2;
    const ratio = getSafeRatio(imgWidth, imgHeight);

    if (widthMode === "auto") {
      // Fit within the viewport *minus padding*, then let the SECTION shrink-wrap this box.
      if (ratio) {
        style.width = `min(calc(100vw - ${pad2}px), calc((100vh - ${pad2}px) * ${ratio}))`;
        style.height = `min(calc(100vh - ${pad2}px), calc((100vw - ${pad2}px) / ${ratio}))`;
        style.aspectRatio = `${imgWidth} / ${imgHeight}`;
      } else {
        style.width = `calc(100vw - ${pad2}px)`;
        style.height = `calc(100vh - ${pad2}px)`;
      }
    } else {
      if (imgWidth && imgHeight) {
        style.aspectRatio = `${imgWidth} / ${imgHeight}`;
      }
    }

    return style;
  }, [imgWidth, imgHeight, widthMode, resolvedPadding]);

  const objectFit: "cover" | "contain" = widthMode === "auto" ? "contain" : "cover";

  // Pre-decode image as section approaches viewport (horizontal-safe rootMargin)
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
      {
        root: null,
        rootMargin: "0px 50% 0px 50%",
        threshold: 0.01,
      }
    );

    observer.observe(sectionEl);

    return () => observer.disconnect();
  }, [imgUrl]);

  // Key change: no `w-screen`. With `flex-none` + content sized children, the panel collapses
  // to the image box width (plus padding).
  const sectionStyle: React.CSSProperties = {
    padding: resolvedPadding,
    contain: "layout paint",
  };

  const label = title ?? "Project image";

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      className="h-auto md:h-screen flex flex-none items-center justify-center relative overflow-hidden will-change-transform"
      style={sectionStyle}
      aria-label={label}
      data-cursor-blend="normal"
    >
      <figure className="relative inline-flex flex-col items-center max-w-[100vw]">
        <div className={clsx("relative overflow-hidden", boxClass)} style={boxStyle}>
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
        </div>

        {title ? (
          <figcaption className="mt-2 w-full max-w-full px-1 text-xs md:text-sm tracking-tight font-serif opacity-70 text-center break-words">
            {title}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}
